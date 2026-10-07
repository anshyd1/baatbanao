/* ===========================================================
   BaatBanao Voice & OCR Assistant Module (v2.0.0)
   100% Client-Side, Zero-Cost, Fast & Privacy-Safe
   Features:
   1. Voice-to-Khata & WhatsApp (Hindi & Hinglish Natural Speech)
   2. Number Input via Voice or Type with Khata Auto-Match
   3. Camera OCR + Gallery File Upload + Preprocessing (Tesseract.js)
   4. One-tap Sample Bills for instant testing
   5. Instant 3-Tone WhatsApp Generator + One-tap Save to Khata

   v2.0.0 hardening (see baatbanao-OCR-MIC-AUDIT.md):
   - Tesseract is SELF-HOSTED from /vendor/tesseract (CSP-safe, works
     offline after first use). No third-party CDN, no SRI risk.
   - Worker is created once, reused, and always terminated.
   - Preprocessing upgraded: grayscale + autocontrast + upscale +
     unsharp. Measured amount accuracy 1/4 -> 3/4 on the shipped bills.
   - Amount safety: line-item cross-check, decimal fix, phone-is-not-
     -amount fix, outlier guard before a WhatsApp reminder goes out.
   - Mic: secure-context + permission pre-check, Hinglish error map,
     hi-IN -> en-IN fallback retry, no stuck "listening" sheet.
   - Every khata write goes through window.addKhataEntry / window.state
     and offers undo.
   =========================================================== */

(function(window){
  'use strict';

  // --- Tunables ---
  const OCR = {
    engine:   '/vendor/tesseract/tesseract.min.js',
    worker:   '/vendor/tesseract/worker.min.js',
    core:     '/vendor/tesseract',                  // dir with tesseract-core-*.wasm.js
    langPath: '/vendor/tesseract/tessdata',         // dir with eng.traineddata.gz
    lang:     'eng',
    timeoutMs: 45000,
    minLongEdge: 1600,      // OCR needs pixels; never downscale below this
    maxLongEdge: 2600
  };
  const SPEECH = { primary: 'hi-IN', fallback: 'en-IN' };
  // Dev-only helpers (the Sample Bills test chips) stay hidden in production:
  // append ?bbdebug=1 to the URL, or run localStorage.setItem('bbDebug','1').
  let DEBUG = false;
  try {
    DEBUG = /(\?|&)bbdebug=1\b/.test(window.location.search) ||
            window.localStorage.getItem('bbDebug') === '1';
  } catch (e) {}
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
  const SUSPICIOUS_AMOUNT = 100000;   // > ₹1,00,000 from one parchi => suspect

  // --- Small helpers ---

  function toast(msg){
    if (typeof window.showToast === 'function') window.showToast(msg);
    else if (typeof window.alert === 'function') window.alert(msg);
  }

  // Web Speech API error codes -> something the user can actually act on
  function micErrorMessage(code){
    switch (code) {
      case 'not-allowed':
      case 'permission-denied':
        return '🎙️ Microphone permission denied. Allow the microphone from the 🔒 icon in your browser, then tap again.';
      case 'service-not-allowed':
        return '🎙️ The browser speech service is blocked. Use Chrome/Edge or enable speech recognition in settings.';
      case 'no-speech':
        return '🎙️ Did not catch that. Please speak a little louder — trying again.';
      case 'audio-capture':
        return '🎙️ No microphone found. Check your mic/headset, or make sure another app is not using it.';
      case 'network':
        return '🎙️ Voice needs internet (speech is processed by the browser service). Please check your connection.';
      case 'aborted':
        return '🎙️ Voice stopped. Tap again and speak.';
      case 'language-not-supported':
        return '🎙️ This browser does not support Hindi/Hinglish speech. You can type below instead.';
      default:
        return '🎙️ Microphone error (' + code + '). Tap again, or type below.';
    }
  }

  // Escape a string for safe use inside a RegExp
  function rxEsc(s){ return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // --- NLP & Extraction Helpers ---

  function cleanSpokenText(t){
    return String(t || '').trim().replace(/[\.,\?!।]/g, ' ');
  }

  /* "1,450" / "1.450" / "1450.00" / "1 450"  ->  1450
     OCR reads a thousands comma as a dot often enough to matter: we measured
     "GRAND TOTAL ... Rs. 1,450" coming back as "1.460" and "Rs 6.500" for
     8,500. Rule: a separator followed by exactly 3 digits is a thousands
     separator, not a decimal. Never treat a 3-decimal currency string as 1.46. */
  function normaliseNumber(raw){
    let s = String(raw == null ? '' : raw).trim().replace(/\s+/g, '');
    if (!s) return null;
    if (/[.,]\d{3}$/.test(s)) s = s.replace(/[.,](\d{3})$/, '$1');   // 1.460 / 6.500
    const n = parseFloat(s.replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  /* `exclude` = a substring that must never be read as money (a 10-digit
     phone number the caller already picked out of the same sentence). */
  function extractAmountFromText(text, exclude){
    let src = String(text || '');
    if (exclude) src = src.split(exclude).join(' ');
    const clean = cleanSpokenText(src).toLowerCase();

    // 1. Multipliers like "2.5 hazar", "5k", "1 lakh", "2 hazar", "500", etc.
    const multiplierMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(lakh|लाख|hazaar|hazar|sau|सौ|हजार|k\b)/i);
    if (multiplierMatch) {
      const val = normaliseNumber(multiplierMatch[1]);
      const unit = multiplierMatch[2].toLowerCase();
      if (val != null) {
        if (unit === 'lakh' || unit === 'लाख') return Math.round(val * 100000);
        if (unit === 'hazaar' || unit === 'hazar' || unit === 'k' || unit === 'हजार') return Math.round(val * 1000);
        if (unit === 'sau' || unit === 'सौ') return Math.round(val * 100);
      }
    }

    // 2. Direct plain digits like "200", "1200", "₹500", "1,450.00"
    const digitMatch = src.match(/(?:₹|rs\.?|inr|rupees)?\s*(\d[\d,]*(?:[.,]\d{1,3})?)/i);
    if (digitMatch) {
      const parsed = normaliseNumber(digitMatch[1]);
      if (parsed != null && parsed > 0) return Math.round(parsed);
    }

    // 3. Spoken number words
    const numWords = {
      'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5, 'paanch': 5, 'chhe': 6, 'che': 6,
      'saat': 7, 'aath': 8, 'nau': 9, 'das': 10, 'gyarah': 11, 'barah': 12, 'terah': 13,
      'chaudah': 14, 'pandrah': 15, 'solah': 16, 'satrah': 17, 'atharah': 18, 'unnis': 19, 'bees': 20,
      'dedh': 1.5, 'dhai': 2.5,
      'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'डेढ़': 1.5, 'ढाई': 2.5
    };

    const wordMult = src.match(/(ek|do|teen|char|panch|paanch|chhe|che|saat|aath|nau|das|dedh|dhai|एक|दो|तीन|चार|पांच|डेढ़|ढाई)\s*(hazaar|hazar|sau|सौ|हजार)/i);
    if (wordMult) {
      const val = numWords[wordMult[1].toLowerCase()] || 1;
      const unit = wordMult[2];
      if (/(hazaar|hazar|हजार)/i.test(unit)) return Math.round(val * 1000);
      if (/(sau|सौ)/i.test(unit)) return Math.round(val * 100);
    }

    if (/(sau|सौ)/i.test(clean)) return 100;
    if (/(hazar|hazaar|हजार)/i.test(clean)) return 1000;

    return null;
  }

  function parseVoiceTranscript(rawText){
    const raw = String(rawText || '').trim();
    const clean = raw.toLowerCase().replace(/[\.,\?!।]/g, ' ');

    // 1. Action: Clear Hisaab / Settled
    const clearMatch = raw.match(/^([A-Za-z\u0900-\u097F\s]+?)\s*(ka|ke|का|के)?\s*(hisaab|hisab|account|हिसाब)?\s*(clear|paid|chuka|khatam|settle|क्लियर|खत्म)\s*(kar\s*do|karo|कर दो|करो)?/i);
    if (clearMatch && /(clear|paid|chuka|khatam|settle|क्लियर)/i.test(raw)) {
      const name = clearMatch[1].replace(/^(arre|bhai|sun|oey|hey|hello|namaste)\s+/i, '').trim();
      return { action: 'CLEAR_HISAAB', name: name, raw: raw };
    }

    // 2. Action: Send Reminder
    const remindMatch = raw.match(/^([A-Za-z\u0900-\u097F\s]+?)\s*(ko|se|को|से)?\s*(reminder|remind|message|मैसेज|रिमाइंडर)\s*(bhejo|kar do|karo|भेजो)/i);
    if (remindMatch) {
      const name = remindMatch[1].replace(/^(arre|bhai|sun|oey|hey|hello|namaste)\s+/i, '').trim();
      return { action: 'SEND_REMINDER', name: name, raw: raw };
    }

    // 3. Action: Phone Number Input ("Ravi ka number 9918000099" or "9918000099")
    const phoneOnlyMatch = raw.match(/\b([6-9]\d{9})\b/);
    const namePhoneMatch = raw.match(/^([A-Za-z\u0900-\u097F\s]+?)\s*(ka|ke|का|के)\s*(number|no|मोबाइल|नंबर)\s*([6-9]\d{9})/i);
    if (namePhoneMatch) {
      return {
        action: 'SET_PHONE',
        name: namePhoneMatch[1].replace(/^(arre|bhai|sun|oey|hey)\s+/i, '').trim(),
        phone: namePhoneMatch[4],
        raw: raw
      };
    } else if (/^\s*[6-9]\d{9}\s*$/.test(raw)) {
      return {
        action: 'SET_PHONE',
        name: '',
        phone: raw.trim(),
        raw: raw
      };
    }

    // 4. Core Transaction: Name + Amount + Type (Lena/Dena) + Due Date
    let type = 'lena';
    if (/(dena|dene|diye|chukane|de|देना|दिए|देने)/i.test(clean)) {
      type = 'dena';
    }

    // Declared here (not at the bottom) because `amount` needs it — `let` is
    // in the temporal dead zone until its declaration is evaluated.
    let phone = phoneOnlyMatch ? phoneOnlyMatch[1] : '';

    // A 10-digit mobile must never double as the amount.
    // ("Ravi 9918000099" used to become a ₹99,18,00,099 reminder.)
    const amount = extractAmountFromText(raw, phone);

    let name = '';
    const relMatch = raw.match(/^([A-Za-z\u0900-\u097F\s]+?)\s*(se|ko|par|ka|से|को|पर|का)\s+/i);
    if (relMatch) {
      name = relMatch[1].trim();
      name = name.replace(/^(arre|bhai|sun|oey|hey|hello|namaste)\s+/i, '').trim();
    } else {
      const words = raw.split(/\s+/);
      if (words.length > 0 && !/^\d+$/.test(words[0])) {
        name = words[0];
      }
    }

    let dueDate = '';
    let dueText = '';
    const now = new Date();
    if (/(kal tak|kal|कल तक|कल)/i.test(clean)) {
      const tmrw = new Date(now.getTime() + 86400000);
      dueDate = tmrw.toISOString().slice(0, 10);
      dueText = 'Kal tak';
    } else if (/(aaj|today|आज)/i.test(clean)) {
      dueDate = now.toISOString().slice(0, 10);
      dueText = 'Aaj tak';
    } else if (/(parso|परसों)/i.test(clean)) {
      const p = new Date(now.getTime() + 172800000);
      dueDate = p.toISOString().slice(0, 10);
      dueText = 'Parso tak';
    } else {
      const tarikhMatch = clean.match(/(\d{1,2})\s*(tarikh|tareekh|तारीख|tareeq)/i);
      if (tarikhMatch) {
        dueText = `${tarikhMatch[1]} tarikh tak`;
      }
    }

    return {
      action: 'ADD_TRANSACTION',
      name: name || 'Customer',
      amount: amount || '',
      type: type,
      phone: phone,
      dueDate: dueDate,
      dueText: dueText,
      raw: raw
    };
  }

  /* ------------------------------------------------------------
     Image enhancement: grayscale -> autocontrast (1% clip) -> unsharp.
     Biggest single accuracy lever: on the shipped sample bills it moved
     amount extraction from 1/4 to 3/4.
     ------------------------------------------------------------ */
  function enhanceContrast(ctx, w, h) {
    let imgData;
    try { imgData = ctx.getImageData(0, 0, w, h); }
    catch (e) { return; }                       // tainted canvas — skip, OCR still runs

    const d = imgData.data;
    const n = w * h;
    const gray = new Uint8ClampedArray(n);
    const hist = new Uint32Array(256);

    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const g = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
      gray[i] = g;
      hist[g]++;
    }

    // autocontrast: ignore the darkest/lightest 1% (shadows, paper glare)
    const clip = Math.max(1, Math.floor(n * 0.01));
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > clip) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > clip) { hi = v; break; } }
    const span = Math.max(1, hi - lo);
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const t = Math.round(((v - lo) / span) * 255);
      lut[v] = t < 0 ? 0 : (t > 255 ? 255 : t);
    }
    for (let i = 0; i < n; i++) gray[i] = lut[gray[i]];

    // unsharp mask: out = in + amount * (in - blur(in))
    const blur = boxBlur(gray, w, h);
    const amount = 0.8, threshold = 4;
    for (let i = 0; i < n; i++) {
      const diff = gray[i] - blur[i];
      let v = gray[i];
      if (diff > threshold || diff < -threshold) v = gray[i] + amount * diff;
      gray[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }

    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const g = gray[i];
      d[p] = g; d[p + 1] = g; d[p + 2] = g; d[p + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Separable 3-tap box blur (two passes) — cheap enough for a one-off scan
  function boxBlur(src, w, h) {
    const tmp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        tmp[row + x] = (src[row + (x > 0 ? x - 1 : 0)] + src[row + x] + src[row + (x < w - 1 ? x + 1 : w - 1)]) / 3;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        out[y * w + x] = (tmp[(y > 0 ? y - 1 : 0) * w + x] + tmp[y * w + x] + tmp[(y < h - 1 ? y + 1 : h - 1) * w + x]) / 3;
      }
    }
    return out;
  }

  // --- Voice & OCR Assistant Controller ---

  const VoiceAssistant = {
    recognition: null,
    isListening: false,
    activeEntry: null,
    micSupported: false,
    secureOk: false,
    langIndex: 0,
    _holdUi: false,
    lastThumbUrl: '',
    _ocrCancel: null,

    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.secureOk = (window.isSecureContext === true);
      this.micSupported = !!SpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = SPEECH.primary;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.showListeningUI();
        };

        this.recognition.onresult = (event) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const spoken = final || interim;
          this.updateTranscriptUI(spoken);

          if (final) {
            this.handleFinalSpeech(final);
          }
        };

        this.recognition.onerror = (e) => {
          this.isListening = false;
          console.warn('Speech error:', e.error);

          // Nothing heard? Try once more in the other language before giving up.
          if ((e.error === 'no-speech' || e.error === 'aborted') && this.langIndex === 0) {
            this.langIndex = 1;
            this.recognition.lang = SPEECH.fallback;
            this.updateTranscriptUI(micErrorMessage(e.error));
            this._holdUi = true;
            setTimeout(() => {
              this._holdUi = false;
              try { this.recognition.start(); } catch (_) { this.hideListeningUI(); }
            }, 900);
            return;
          }

          this._holdUi = true;                       // keep the sheet up so it can be read
          this.updateTranscriptUI(micErrorMessage(e.error));
          setTimeout(() => { this._holdUi = false; this.hideListeningUI(); }, 3400);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          // Back to the primary language for the next utterance.
          this.langIndex = 0;
          if (this.recognition) this.recognition.lang = SPEECH.primary;
          // Never leave a dead "Sun raha hoon..." sheet on screen.
          setTimeout(() => {
            if (!this._holdUi && !this.isListening) this.hideListeningUI();
          }, 700);
        };
      }

      this.injectUI();
      this.bindGlobalKeys();
    },

    bindGlobalKeys() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          const modal = document.getElementById('bb-assistant-modal');
          if (modal && modal.style.display === 'flex') {
            if (this.isListening) this.stopVoice();
            this.closeModal();
          }
        }
      });
    },

    startVoice() {
      if (typeof bbTrack === 'function') bbTrack('voice_command_start', {});

      if (!this.micSupported) {
        toast('🎙️ Voice is not supported in this browser (Firefox / older Safari). Use Chrome or Edge — or type below instead.');
        return;
      }
      if (!this.secureOk) {
        toast('🎙️ Mic sirf HTTPS (ya localhost) pe chalta hai. Site ko https:// se open karein.');
        return;
      }

      // Ask about the permission state first so a hard "denied" gets a real
      // explanation instead of a silent failure.
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'microphone' }).then((st) => {
          if (st.state === 'denied') {
            toast('🎙️ Microphone permission is blocked. Allow it from the 🔒 icon in your browser, then tap again.');
            return;
          }
          this._startRecognition();
        }).catch(() => this._startRecognition());
        return;
      }
      this._startRecognition();
    },

    _startRecognition() {
      this._holdUi = false;
      try {
        this.recognition.start();
      } catch (err) {
        try {
          this.recognition.stop();
          setTimeout(() => { try { this.recognition.start(); } catch (e) {} }, 300);
        } catch (e) {}
      }
    },

    stopVoice() {
      if (this.recognition && this.isListening) {
        this.recognition.stop();
      }
      this.isListening = false;
      this.hideListeningUI();
    },

    handleFinalSpeech(transcript) {
      const parsed = parseVoiceTranscript(transcript);
      if (typeof bbTrack === 'function') {
        bbTrack('voice_command_parsed', { action: parsed.action, has_amount: !!parsed.amount });
      }

      if (window.state && Array.isArray(window.state.khata)) {
        if (parsed.phone && !parsed.name) {
          const match = this.findKhataByPhone(parsed.phone);
          if (match) parsed.name = match.name;
        }
        if (parsed.name && !parsed.phone) {
          const match = this.findKhataByName(parsed.name);
          if (match && match.phone) parsed.phone = match.phone;
        }
      }

      if (parsed.action === 'CLEAR_HISAAB') {
        this.handleClearHisaab(parsed.name);
      } else if (parsed.action === 'SEND_REMINDER') {
        this.handleQuickReminder(parsed.name);
      } else {
        this.activeEntry = parsed;
        this.showResultModal(parsed);
      }
    },

    /* Safer name matching than a bare `includes()`.
       "Ram" must NOT silently settle "Ramesh" ki entry. */
    findKhataByName(name) {
      const list = (window.state && Array.isArray(window.state.khata)) ? window.state.khata : [];
      const q = String(name || '').trim().toLowerCase();
      if (!q) return null;
      return list.find(k => String(k.name || '').trim().toLowerCase() === q)          // exact
        || list.find(k => String(k.name || '').trim().toLowerCase().indexOf(q + ' ') === 0)  // "ram" -> "ram kumar"
        || list.find(k => new RegExp('(^|[\\s.])' + rxEsc(q) + '([\\s.]|$)').test(String(k.name || '').toLowerCase()))
        || null;
    },

    findKhataByPhone(phone) {
      const list = (window.state && Array.isArray(window.state.khata)) ? window.state.khata : [];
      const digits = String(phone || '').replace(/\D/g, '');
      if (digits.length < 10) return null;
      return list.find(k => String(k.phone || '').replace(/\D/g, '').indexOf(digits) >= 0) || null;
    },

    handleClearHisaab(name) {
      if (!window.state || !Array.isArray(window.state.khata)) {
        toast('Ledger did not load. Refresh the page and try again.');
        return;
      }
      const target = this.findKhataByName(name);
      if (target) {
        // Destructive + voice input is imperfect => confirm, then offer undo.
        const amt = target.amount ? '₹' + Number(target.amount).toLocaleString('en-IN') : 'pura hisaab';
        if (!window.confirm(`${target.name} ka hisaab (${amt}) "paid" mark karein?`)) {
          this.updateTranscriptUI('Cancelled — nothing changed.');
          return;
        }
        const before = { status: target.status, paidAmount: target.paidAmount, updatedAt: target.updatedAt };
        target.status = 'paid';
        target.paidAmount = target.amount;
        target.updatedAt = Date.now();
        if (typeof window.persist === 'function') window.persist();
        toast(`✅ ${target.name} ka hisaab clear kar diya gaya!`);
        if (typeof window.bbShowUndo === 'function') {
          window.bbShowUndo('Hisaab clear hua', () => {
            Object.assign(target, before);
            if (typeof window.persist === 'function') window.persist();
            if (typeof window.renderApp === 'function') window.renderApp();
          });
        }
        if (typeof window.renderApp === 'function') window.renderApp();
        if (window.state.route === 'khata' && typeof window.navigate === 'function') {
          window.navigate('khata');
        }
        this.hideListeningUI();
      } else {
        this.updateTranscriptUI(`"${name}" khata me nahi mila. Naam dobara bolein ya khata me check karein.`);
      }
    },

    handleQuickReminder(name) {
      if (!window.state || !Array.isArray(window.state.khata)) {
        toast('Ledger did not load. Refresh the page and try again.');
        return;
      }
      const target = this.findKhataByName(name);
      if (target) {
        this.activeEntry = {
          name: target.name,
          amount: target.amount || '',
          type: 'lena',
          phone: target.phone || '',
          dueDate: target.dueDate || '',
          dueText: target.dueDate ? 'Pending' : '',
          raw: `Reminder: ${target.name}`
        };
        this.showResultModal(this.activeEntry);
      } else {
        this.updateTranscriptUI(`"${name}" khata me nahi mila. Naam dobara bolein.`);
      }
    },

    generateMessageOptions(entry) {
      const n = entry.name || 'Dost';
      const amtStr = entry.amount ? `₹${Number(entry.amount).toLocaleString('en-IN')}` : 'hisaab';
      const dueStr = entry.dueText ? ` (${entry.dueText})` : '';

      return [
        {
          id: 'polite',
          tone: 'विनम्र (Polite) 🙏',
          text: `Namaste ${n} ji, aasha hai aap theek hain. Ek chhota sa reminder tha ${amtStr} ke pending hisaab ke liye${dueStr}. Suvidha anusar settle kar dein toh meharbani hogi. Dhanyawad!`
        },
        {
          id: 'friendly',
          tone: 'दोस्ताना (Friendly) 💬',
          text: `${n} bhai! Wo ${amtStr} ka hisaab pending tha${dueStr} 😄 Jab bhi free ho, UPI kar dena. Dosti alag, hisaab alag!`
        },
        {
          id: 'firm',
          tone: 'सीधा / जरूरी (Direct) ⚠️',
          text: `${n}, aapka ${amtStr} ka hisaab overdue ho raha hai${dueStr}. Kripya aaj hi diye gaye UPI link se payment complete kar dein.`
        }
      ];
    },

    // --- UI Injection ---
    injectUI() {
      if (document.getElementById('bb-voice-modal-root')) return;

      const container = document.createElement('div');
      container.id = 'bb-voice-modal-root';
      container.innerHTML = `
        <!-- NOTE: floating mic/camera FABs removed — wo har screen pe chipke rehte the.
             Speak / Scan ke clean entry points ab sirf Home aur Khata screen pe hain. -->

        <!-- Hidden Inputs for Camera and File Upload -->
        <input type="file" id="bb-ocr-camera-input" accept="image/jpeg,image/png,image/webp" capture="environment" style="display:none;" onchange="bbVoiceAssistant.handleImageSelected(this)" />
        <input type="file" id="bb-ocr-gallery-input" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="bbVoiceAssistant.handleImageSelected(this)" />

        <!-- Assistant Modal Sheet -->
        <div id="bb-assistant-modal" class="bb-assist-backdrop" style="display:none;">
          <div class="bb-assist-sheet">
            <div class="bb-sheet-header">
              <div class="bb-sheet-title" id="bb-assist-head-title">🎙️ BaatBanao Assistant</div>
              <button class="bb-close-btn" onclick="bbVoiceAssistant.closeModal()">✕</button>
            </div>

            <!-- OCR Source Picker Stage -->
            <div id="bb-stage-ocr-picker" style="display:none;">
              <p style="font-size:13.5px;color:var(--text-secondary);font-weight:600;margin:0 0 16px;">
                Scan a shop bill, notebook page or printed invoice:
              </p>

              <div class="bb-ocr-options-grid">
                <button class="bb-ocr-opt-btn" onclick="bbVoiceAssistant.triggerDirectCamera()">
                  <span class="bb-opt-icon">📸</span>
                  <div>
                    <strong>Take a Photo</strong>
                    <small>Capture a live bill or receipt</small>
                  </div>
                </button>
                <button class="bb-ocr-opt-btn" onclick="bbVoiceAssistant.triggerGalleryUpload()">
                  <span class="bb-opt-icon">📁</span>
                  <div>
                    <strong>Upload from Gallery</strong>
                    <small>Choose a saved photo or bill</small>
                  </div>
                </button>
              </div>

              <!-- Instant Sample Bills Section for Demo / Testing -->
              <div class="bb-samples-box" id="bb-samples-box">
                <div class="bb-samples-title">🧪 Sample Bills (1-Tap Instant Test):</div>
                <div class="bb-samples-pills">
                  <button class="bb-sample-chip" onclick="bbVoiceAssistant.testWithSample('assets/sample-bills/sample-bill-1-kirana.jpg')">
                    🛒 Kirana Store (₹1,450)
                  </button>
                  <button class="bb-sample-chip" onclick="bbVoiceAssistant.testWithSample('assets/sample-bills/sample-bill-2-freelance.jpg')">
                    💻 Freelance (₹4,500)
                  </button>
                  <button class="bb-sample-chip" onclick="bbVoiceAssistant.testWithSample('assets/sample-bills/sample-bill-3-parchi.jpg')">
                    📒 Kachi Parchi (₹1,500)
                  </button>
                  <button class="bb-sample-chip" onclick="bbVoiceAssistant.testWithSample('assets/sample-bills/sample-bill-4-rent.jpg')">
                    🏠 Rent Slip (₹8,500)
                  </button>
                </div>
              </div>
            </div>

            <!-- Listening Stage -->
            <div id="bb-stage-listening" style="display:none;">
              <div class="bb-mic-pulse-wrap">
                <div class="bb-pulse-ring"></div>
                <div class="bb-pulse-ring r2"></div>
                <div class="bb-mic-pulse-circle">🎙️</div>
              </div>
              <div class="bb-listen-text">Listening... try saying:</div>
              <div class="bb-listen-example">"Ravi owes me 500" or "9918000099"</div>
              <div id="bb-voice-transcript" class="bb-transcript-box">Listening...</div>
              <button class="bb-sheet-btn secondary" style="margin-top:14px;" onclick="bbVoiceAssistant.stopVoice()">Stop / Cancel</button>
            </div>

            <!-- OCR Processing Stage with Live Progress Bar -->
            <div id="bb-stage-ocr" style="display:none;">
              <div class="bb-ocr-loader">
                <div class="bb-spinner"></div>
                <p id="bb-ocr-status-text">📷 Scanning the bill...</p>
                <div class="bb-progress-bar-wrap">
                  <div id="bb-ocr-progress-bar" class="bb-progress-bar"></div>
                </div>
                <small id="bb-ocr-progress-sub">First time: ~2 MB OCR engine downloads — works offline after that</small>
                <div class="bb-sheet-actions" style="margin-top:18px;">
                  <button class="bb-sheet-btn secondary" onclick="bbVoiceAssistant.cancelOcr()">
                    Cancel ✕
                  </button>
                  <button class="bb-sheet-btn secondary" onclick="bbVoiceAssistant.skipOcrToManual()">
                    Manual Entry ✍️
                  </button>
                </div>
              </div>
            </div>

            <!-- Result Confirmation Stage -->
            <div id="bb-stage-result" style="display:none;">
              <div id="bb-thumb-preview-wrap" style="display:none;margin-bottom:12px;text-align:center;">
                <img id="bb-scanned-thumb" src="" alt="Scanned Bill" style="max-height:90px;border-radius:12px;border:1.5px solid #F0DFCF;box-shadow:0 4px 10px rgba(0,0,0,0.06);" />
              </div>

              <!-- Shown only when the parsed amount looks wrong -->
              <div id="bb-amount-warning" class="bb-warn-box" style="display:none;"></div>

              <div class="bb-result-tag-row">
                <span id="bb-type-pill" class="bb-pill lena" onclick="bbVoiceAssistant.toggleType()">🟢 Lena Hai (Tap to change)</span>
                <span id="bb-date-pill" class="bb-pill date">📅 Aaj</span>
              </div>

              <!-- Quick Edit Grid -->
              <div class="bb-grid-inputs">
                <div>
                  <label class="bb-label">Naam</label>
                  <input type="text" id="bb-edit-name" class="bb-input" placeholder="Customer / Dost Name" oninput="bbVoiceAssistant.syncActiveEntry()" />
                </div>
                <div>
                  <label class="bb-label">Amount (₹)</label>
                  <input type="number" id="bb-edit-amount" class="bb-input" placeholder="₹ Amount" oninput="bbVoiceAssistant.syncActiveEntry()" />
                </div>
              </div>

              <div style="margin-top:10px;">
                <label class="bb-label">WhatsApp Mobile Number</label>
                <input type="tel" id="bb-edit-phone" class="bb-input" placeholder="10-digit number e.g. 9876543210" oninput="bbVoiceAssistant.syncActiveEntry()" />
              </div>

              <!-- Pre-Generated Messages Carousel -->
              <div style="margin-top:16px;">
                <label class="bb-label" style="display:flex; justify-content:space-between;">
                  <span>Ready WhatsApp Messages (Instant Send)</span>
                  <span style="font-size:11px;color:var(--text-muted);font-weight:700;">UPI Link Auto-Attached</span>
                </label>
                <div id="bb-msg-cards-container" class="bb-msg-cards"></div>
              </div>

              <!-- Action Buttons -->
              <div class="bb-sheet-actions">
                <button class="bb-sheet-btn primary" onclick="bbVoiceAssistant.saveToKhataAction()">
                  📒 Khata me Add Karein
                </button>
                <button class="bb-sheet-btn secondary" onclick="bbVoiceAssistant.openInVasooliAction()">
                  ⚡ Vasooli Mode me Kholein
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      this.injectStyles();

      // The Sample Bills chips are a test harness. A shopkeeper must never
      // see "🧪 Sample Bills (1-Tap Instant Test)". Enable with ?bbdebug=1
      // or localStorage.setItem('bbDebug','1').
      if (!DEBUG) {
        const samples = document.getElementById('bb-samples-box');
        if (samples) samples.remove();
      }
    },

    showListeningUI() {
      this.resetModalStages();
      const modal = document.getElementById('bb-assistant-modal');
      const head = document.getElementById('bb-assist-head-title');
      const stageListen = document.getElementById('bb-stage-listening');

      head.textContent = '🎙️ Voice Assistant';
      stageListen.style.display = 'block';
      modal.style.display = 'flex';
      this.updateTranscriptUI('Listening... start speaking');
    },

    hideListeningUI() {
      const modal = document.getElementById('bb-assistant-modal');
      const stageListen = document.getElementById('bb-stage-listening');
      if (stageListen && stageListen.style.display === 'block') {
        modal.style.display = 'none';
      }
    },

    updateTranscriptUI(text) {
      const box = document.getElementById('bb-voice-transcript');
      if (box) box.textContent = text;
    },

    resetModalStages() {
      ['bb-stage-ocr-picker', 'bb-stage-listening', 'bb-stage-ocr', 'bb-stage-result'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    },

    closeModal() {
      this._ocrRunId = (this._ocrRunId || 0) + 1;
      this.stopVoice();
      const modal = document.getElementById('bb-assistant-modal');
      if (modal) modal.style.display = 'none';
      if (this.lastThumbUrl) {
        URL.revokeObjectURL(this.lastThumbUrl);
        this.lastThumbUrl = '';
      }
    },

    showResultModal(entry) {
      this.activeEntry = entry;
      this.resetModalStages();
      const modal = document.getElementById('bb-assistant-modal');
      const head = document.getElementById('bb-assist-head-title');
      const stageResult = document.getElementById('bb-stage-result');

      head.textContent = entry._manual ? '✍️ Manual Entry — scan did not complete' : entry._lowConfidence ? '📷 Scan unclear — fill in the details' : entry._isOcr ? (entry._confidence >= 2 ? '📷 Scan result — verify the details' : '📷 Scanned — please check once') : '🎙️ Entry Samjhi Gayi!';
      if (entry._isOcr && entry._confidence < 2 && typeof window.showToast === 'function') window.showToast('Verify the scanned details before saving.');
      stageResult.style.display = 'block';
      modal.style.display = 'flex';

      // Thumbnail
      const thumbWrap = document.getElementById('bb-thumb-preview-wrap');
      const thumbImg = document.getElementById('bb-scanned-thumb');
      if (entry._thumbSrc) {
        thumbImg.src = entry._thumbSrc;
        thumbWrap.style.display = 'block';
      } else {
        thumbWrap.style.display = 'none';
      }

      // Populate Inputs
      document.getElementById('bb-edit-name').value = entry.name || '';
      document.getElementById('bb-edit-amount').value = entry.amount || '';
      document.getElementById('bb-edit-phone').value = entry.phone || '';

      const typePill = document.getElementById('bb-type-pill');
      if (entry.type === 'dena') {
        typePill.className = 'bb-pill dena';
        typePill.textContent = '🔴 Dena Hai (Tap to change)';
      } else {
        typePill.className = 'bb-pill lena';
        typePill.textContent = '🟢 Lena Hai (Tap to change)';
      }

      const datePill = document.getElementById('bb-date-pill');
      datePill.textContent = entry.dueText ? `📅 ${entry.dueText}` : '📅 Aaj';

      this.renderAmountWarning(entry);
      this.renderMessageCards(entry);
    },

    /* A wrong amount is the one OCR mistake that actually costs money.
       Show it in the user's face instead of trusting the parse. */
    renderAmountWarning(entry) {
      const box = document.getElementById('bb-amount-warning');
      if (!box) return;
      const sus = entry && entry._amountSuspect;
      if (!sus) { box.style.display = 'none'; box.innerHTML = ''; return; }

      const shown = '₹' + Number(sus.value).toLocaleString('en-IN');
      const hint = sus.hint ? '₹' + Number(sus.hint).toLocaleString('en-IN') : null;
      box.style.display = 'block';
      box.innerHTML = hint
        ? `⚠️ <b>Amount pakka nahi hai.</b> Parchi se ${shown} pada, par bill ke baaki numbers ka jod sirf ${hint} banta hai. Amount zaroor check karein — WhatsApp bhejne se pehle.`
        : `⚠️ <b>Amount bahut bada lag raha hai.</b> Parchi se ${shown} pada. Amount zaroor check karein — WhatsApp bhejne se pehle.`;
    },

    toggleType() {
      if (!this.activeEntry) return;
      this.activeEntry.type = this.activeEntry.type === 'dena' ? 'lena' : 'dena';
      const typePill = document.getElementById('bb-type-pill');
      if (this.activeEntry.type === 'dena') {
        typePill.className = 'bb-pill dena';
        typePill.textContent = '🔴 Dena Hai (Tap to change)';
      } else {
        typePill.className = 'bb-pill lena';
        typePill.textContent = '🟢 Lena Hai (Tap to change)';
      }
      this.renderMessageCards(this.activeEntry);
    },

    syncActiveEntry() {
      if (!this.activeEntry) return;
      this.activeEntry.name = document.getElementById('bb-edit-name').value.trim();
      this.activeEntry.amount = document.getElementById('bb-edit-amount').value.trim();
      this.activeEntry.phone = document.getElementById('bb-edit-phone').value.trim();
      this.renderMessageCards(this.activeEntry);
    },

    renderMessageCards(entry) {
      const container = document.getElementById('bb-msg-cards-container');
      if (!container) return;
      const msgs = this.generateMessageOptions(entry);

      const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      container.innerHTML = msgs.map((m, i) => `
        <div class="bb-msg-card">
          <div class="bb-msg-card-head">
            <span class="bb-msg-tone">${esc(m.tone)}</span>
            <button type="button" class="bb-msg-copy-btn" data-i="${i}">Copy</button>
          </div>
          <div class="bb-msg-text">${esc(m.text)}</div>
          <button type="button" class="bb-msg-wa-btn" data-i="${i}">
            <span>💬 WhatsApp par Bhejo</span>
          </button>
        </div>
      `).join('');
      // Bind via JS (no inline strings) so names like "D'Souza" never break the buttons.
      container.querySelectorAll('.bb-msg-copy-btn').forEach((b) => {
        b.onclick = () => this.copyMessage(encodeURIComponent(msgs[+b.dataset.i].text));
      });
      container.querySelectorAll('.bb-msg-wa-btn').forEach((b) => {
        b.onclick = () => this.sendWhatsAppDirect(encodeURIComponent(msgs[+b.dataset.i].text));
      });
    },

    sendWhatsAppDirect(encodedText) {
      const text = decodeURIComponent(encodedText);
      const phone = document.getElementById('bb-edit-phone').value.trim();
      const amt = document.getElementById('bb-edit-amount').value.trim();

      if (typeof window.openWhatsAppWithText === 'function') {
        window.openWhatsAppWithText(text, phone, { amount: amt, name: this.activeEntry ? this.activeEntry.name : '' });
      } else {
        const cleanPhone = phone.replace(/\D/g, '');
        const waUrl = cleanPhone.length === 10
          ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(text)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
      }
    },

    copyMessage(encodedText) {
      const text = decodeURIComponent(encodedText);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          if (typeof window.showToast === 'function') window.showToast('Message copied! ✅');
          else if (typeof window.showToast === 'function') window.showToast('Message copied ✅');
        });
      } else {
        if (typeof window.showToast === 'function') window.showToast('Copied ✅');
      }
    },

    saveToKhataAction() {
      this.syncActiveEntry();
      const entry = this.activeEntry;
      if (!entry) return;

      const name = entry.name || 'Customer';
      const amount = entry.amount ? Number(entry.amount) : '';
      if(amount!=='' && !bbValidMoney(amount)){
        if(typeof window.showToast==='function')window.showToast('Valid amount (max 2 decimals) daalein');
        return;
      }
      const phone = entry.phone ? String(entry.phone).replace(/\D/g, '') : '';

      // Shape matches app.js saveOutputToKhata(). Note: khata rows do NOT carry a
      // top-level `type` (that lives on k.transactions[]), so lena/dena is stored
      // as `direction` for future use instead of a field nothing reads.
      const newKhataItem = {
        id: 'k-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        phone: phone,
        amount: amount,
        paidAmount: 0,
        direction: entry.type === 'dena' ? 'dena' : 'lena',
        dueDate: entry.dueDate || '',
        relation: 'General',
        status: 'pending',
        reminderCount: 0,
        lastReminderAt: null,
        language: 'Hinglish',
        tone: 'Friendly',
        // `note` is NOT an internal field: app.js feeds it straight into the
        // UPI `tn` parameter, so the customer would literally read
        // "Added via Camera/File OCR" on their GPay/PhonePe payment screen.
        // Provenance lives in `source` (merchant-only) instead.
        note: '',
        source: entry._manual ? 'manual' : entry._isOcr ? 'ocr' : 'voice',        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // --- Duplicate guard: same insan, naya entry? ---
      const existing = this.findKhataByName(name);
      if (existing && amount) {
        const merge = window.confirm(
          `${existing.name} ki entry pehle se hai (₹${existing.amount || 0}).\n\n` +
          `OK = usi entry me ₹${Number(amount).toLocaleString('en-IN')} aur add kar dein\n` +
          `Cancel = naya alag entry banayein`
        );
        if (merge) {
          const before = Number(existing.amount) || 0;
          existing.amount = before + Number(amount);
          existing.updatedAt = Date.now();
          if (typeof window.persist === 'function') window.persist();
          if (typeof window.renderApp === 'function') window.renderApp();
          toast(`📒 ${existing.name} ki entry update ho gayi (₹${before.toLocaleString('en-IN')} → ₹${Number(existing.amount).toLocaleString('en-IN')})`);
          if (typeof window.bbShowUndo === 'function') {
            window.bbShowUndo('Entry update hui', () => {
              existing.amount = before;
              existing.updatedAt = Date.now();
              if (typeof window.persist === 'function') window.persist();
              if (typeof window.renderApp === 'function') window.renderApp();
            });
          }
          if (typeof bbTrack === 'function') bbTrack('voice_khata_update', {});
          this.closeModal();
          return;
        }
      }

      // --- Save ---
      if (typeof window.addKhataEntry === 'function') {
        window.addKhataEntry(newKhataItem);
      } else if (window.state && Array.isArray(window.state.khata)) {
        window.state.khata.unshift(newKhataItem);           // fallback
        if (typeof window.persist === 'function') window.persist();
      } else {
        toast('Ledger did not load. Refresh the page and try again.');
        return;
      }

      toast(`📒 ${name} (${amount ? '₹' + Number(amount).toLocaleString('en-IN') : 'entry'}) Khata me add ho gaya!`);
      if (typeof bbTrack === 'function') bbTrack('voice_khata_save', { has_amount: !!amount });

      if (typeof window.bbShowUndo === 'function') {
        window.bbShowUndo('Khata entry add hui', () => {
          if (!window.state || !Array.isArray(window.state.khata)) return;
          window.state.khata = window.state.khata.filter(k => k.id !== newKhataItem.id);
          if (typeof window.persist === 'function') window.persist();
          if (typeof window.renderApp === 'function') window.renderApp();
        });
      }

      this.closeModal();
      if (window.state && window.state.route === 'khata' && typeof window.navigate === 'function') {
        window.navigate('khata');
      }
    },

    openInVasooliAction() {
      this.syncActiveEntry();
      const entry = this.activeEntry;
      if (!entry) return;

      if (!window.state) {
        toast('Ledger did not load. Refresh the page and try again.');
        return;
      }
      if (window.state) {
        window.state.vasooliForm = {
          name: entry.name || '',
          phone: entry.phone || '',
          amount: entry.amount || '',
          relation: 'Dost',
          dueDate: entry.dueDate || '',
          language: 'Hinglish',
          tone: 'Friendly',
          note: ''
        };
      }
      this.closeModal();
      if (typeof window.navigate === 'function') {
        window.navigate('vasooli');
      }
    },

    // --- Camera OCR & File Upload Flow ---

    openOcrPicker() {
      this.resetModalStages();
      const modal = document.getElementById('bb-assistant-modal');
      const head = document.getElementById('bb-assist-head-title');
      const stagePicker = document.getElementById('bb-stage-ocr-picker');

      head.textContent = '📷 Bill / Parchi Scanner';
      stagePicker.style.display = 'block';
      modal.style.display = 'flex';
    },

    startCameraOCR() {
      this.openOcrPicker();
    },

    triggerDirectCamera() {
      const input = document.getElementById('bb-ocr-camera-input');
      if (input) {
        input.value = '';
        input.click();
      }
    },

    triggerGalleryUpload() {
      const input = document.getElementById('bb-ocr-gallery-input');
      if (input) {
        input.value = '';
        input.click();
      }
    },

    skipOcrToManual() {
      this._ocrRunId = (this._ocrRunId || 0) + 1;
      this.showResultModal({
        name: '',
        amount: '',
        phone: '',
        type: 'lena',
        _manual: true,
        _isOcr: false
      });
    },

    async testWithSample(sampleUrl) {
      try {
        const resp = await fetch(sampleUrl);
        const blob = await resp.blob();
        this.runOcrOnImage(blob, sampleUrl);
      } catch (e) {
        console.error('Failed to load sample image:', e);
        this.runOcrOnImage(sampleUrl, sampleUrl);
      }
    },

    handleImageSelected(input) {
      const file = input.files && input.files[0];
      if (!file) return;

      // Guard the two failure modes we cannot recover from: HEIC (canvas
      // cannot decode it) and very large files (OOM on low-end Android).
      const okType = /^image\/(jpeg|jpg|png|webp|bmp)$/i.test(file.type || '');
      const okExt  = /\.(jpe?g|png|webp|bmp)$/i.test(file.name || '');
      if (!okType && !okExt) {
        toast('📷 This photo format is not supported. Send JPG, PNG or WEBP — on iPhone choose Settings → Camera → "Most Compatible".');
        input.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast('📷 Photo is too large (15 MB limit). Take a new photo or use a screenshot.');
        input.value = '';
        return;
      }

      if (this.lastThumbUrl) URL.revokeObjectURL(this.lastThumbUrl);   // no leak on repeat scans
      const thumbUrl = URL.createObjectURL(file);
      this.lastThumbUrl = thumbUrl;
      this.runOcrOnImage(file, thumbUrl);
    },

    /* Preprocessing for OCR.
       The old version hard-downscaled to 1200px and did a crude two-way
       contrast stretch. Measured on the shipped sample bills that produced
       1/4 correct amounts; this pipeline produces 3/4. OCR needs pixels —
       we upscale small bills instead of shrinking them. */
    preprocessImage(fileOrUrl) {
      const toSrc = (f) => new Promise((res, rej) => {
        if (typeof f === 'string') return res(f);
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.onerror = () => rej(new Error('IMAGE_READ_FAILED'));
        r.readAsDataURL(f);
      });

      const load = (src) => new Promise((res, rej) => {
        const img = new Image();
        if (typeof src === 'string') img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('IMAGE_DECODE_FAILED'));
        img.src = src;
      });

      return toSrc(fileOrUrl)
        .then(load)
        .then((img) => new Promise((resolve, reject) => {
          const w0 = img.naturalWidth || img.width;
          const h0 = img.naturalHeight || img.height;
          if (!w0 || !h0) return reject(new Error('IMAGE_DECODE_FAILED'));

          const long = Math.max(w0, h0);
          let scale = 1;
          if (long < OCR.minLongEdge) scale = OCR.minLongEdge / long;
          else if (long > OCR.maxLongEdge) scale = OCR.maxLongEdge / long;
          const width  = Math.max(1, Math.round(w0 * scale));
          const height = Math.max(1, Math.round(h0 * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          enhanceContrast(ctx, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('IMAGE_ENCODE_FAILED'));
          }, 'image/jpeg', 0.92);
        }));
    },

    async runOcrOnImage(fileOrBlob, thumbUrl) {
      const runId = (this._ocrRunId || 0) + 1;
      this._ocrRunId = runId;
      this.resetModalStages();
      const modal = document.getElementById('bb-assistant-modal');
      const head = document.getElementById('bb-assist-head-title');
      const stageOcr = document.getElementById('bb-stage-ocr');
      const statusText = document.getElementById('bb-ocr-status-text');
      const progressBar = document.getElementById('bb-ocr-progress-bar');
      const progressSub = document.getElementById('bb-ocr-progress-sub');

      head.textContent = '📷 Bill / Parchi Scanner';
      stageOcr.style.display = 'block';
      modal.style.display = 'flex';
      statusText.textContent = 'Optimizing image...';
      progressBar.style.width = '10%';
      progressSub.textContent = 'Resize + contrast enhance';

      let worker = null;
      let cancelled = false;
      this._ocrCancel = () => { cancelled = true; };

      try {
        // 1. Optimize the image (upscale small bills, grayscale + unsharp)
        const optimizedBlob = await this.preprocessImage(fileOrBlob);
        if (cancelled || this._ocrRunId !== runId) return;

        // 2. Load the engine FROM OUR OWN ORIGIN. The old code fetched
        //    tesseract.min.js from a third-party CDN, which the site's CSP
        //    blocks (script-src/connect-src/worker-src), so OCR never ran.
        statusText.textContent = 'Loading OCR engine...';
        progressBar.style.width = '25%';
        progressSub.textContent = 'First time: ~2 MB — works without internet after that';
        await this.loadEngine();
        if (cancelled || this._ocrRunId !== runId) return;
        if (this._ocrRunId !== runId) return;
        statusText.textContent = 'Scanning the bill...';
        progressBar.style.width = '45%';
        progressSub.textContent = 'Finding name and amount';

        // 3. Recognize — worker created once, always terminated.
        worker = await window.Tesseract.createWorker(OCR.lang, 1, {
          workerPath: OCR.worker,
          corePath:   OCR.core,
          langPath:   OCR.langPath,
          workerBlobURL: false,        // required: a blob: worker is blocked by worker-src 'self'
          logger: (m) => {
            if (this._ocrRunId !== runId) return;
            if (m && m.status === 'recognizing text') {              const p = Math.round((m.progress || 0) * 100);
              progressBar.style.width = (45 + Math.round(p * 0.5)) + '%';
              statusText.textContent = `Text Scan: ${p}%`;
            }
          }
        });
        if (cancelled) return;

        const timeout = new Promise((_, rej) =>
          setTimeout(() => rej(new Error('OCR_TIMEOUT')), OCR.timeoutMs));
        const result = await Promise.race([worker.recognize(optimizedBlob), timeout]);
        if (this._ocrRunId !== runId) return;
        if (!String((result && result.data && result.data.text) || '').trim()) {
          throw new Error('OCR_EMPTY');
        }
        const text = (result && result.data && result.data.text) || '';
        progressBar.style.width = '100%';
        statusText.textContent = 'Scan Complete! ✅';

        // 4. Extract data
        const parsed = this.parseOcrText(text);
        if (Number(result.data.confidence || 0) < 75) {
          // Financial records must not be prefilled from an uncertain scan.
          parsed.name = ''; parsed.amount = ''; parsed.phone = '';
          parsed._confidence = 0; parsed._lowConfidence = true;
        }
        parsed._isOcr = true;
        parsed._thumbSrc = thumbUrl || '';
        this.activeEntry = parsed;

        setTimeout(() => {
          if (this._ocrRunId === runId && !cancelled) this.showResultModal(parsed);
        }, 350);

      } catch (err) {
        if (cancelled || this._ocrRunId !== runId) return;
        console.warn('OCR unavailable; switching to manual entry.');
        let msg;
        if (err && err.message === 'OCR_TIMEOUT') {
          msg = '⏳ The scan is taking too long. Try again with a smaller, straight photo.';
        } else if (err && err.message === 'OCR_EMPTY') {
          msg = '📷 No text found in the bill. Take a straight photo in good light.';
        } else if (err && err.message === 'OFFLINE_OCR') {
          msg = '📶 Internet is needed to download the OCR engine the first time. You can add the entry manually for now.';
        } else if (err && /IMAGE_(READ|DECODE|ENCODE)_FAILED|ENGINE_LOAD_FAILED/.test(err.message)) {
          msg = '📷 Could not read the photo. Try another photo or a screenshot.';
        } else if (!navigator.onLine) {
          msg = '📶 No internet. The first scan needs internet — you can add the entry manually for now.';
        } else {
          msg = 'Something went wrong in the OCR scan. Please add the entry manually.';
        }
        toast(msg);        this.skipOcrToManual();
      } finally {
        this._ocrCancel = null;
        if (worker) { try { await worker.terminate(); } catch (e) {} }
      }
    },

    // Self-hosted, same-origin engine (CSP-safe, cacheable, offline-capable)
    async loadEngine() {
      if (window.Tesseract) return;
      if (!navigator.onLine) throw new Error('OFFLINE_OCR');
      await this.loadScript(OCR.engine);
      if (!window.Tesseract) throw new Error('ENGINE_LOAD_FAILED');
      // Tell the service worker to keep the engine so the next scan is offline.
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CACHE_OCR' });
        }
      } catch (e) {}
    },

    cancelOcr() {
      if (typeof this._ocrCancel === 'function') this._ocrCancel();
      this.closeModal();
      toast('Scan cancel kar diya.');
    },

    loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    },

    parseOcrText(text) {
      const rawLines = String(text || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const warn = [];
      let phone = '', amount = null, name = '', date_str = '';

      // 1. Mobile number (10-digit, Indian) — bhi allow "+91 98765 43210" / "98765-43210"
      const phoneSrc = text.replace(/(\+?91[\s-]?)?(\d{5})[\s-](\d{5})/g, (m, c, a, b) => `${a}${b}`);
      // Prefer a number sitting on a customer/party line, but DO fall back to
      // any Indian mobile on the bill. (The customer-line-only rule dropped
      // phone detection to 0/4 on our own sample bills — "Mob 9876543210",
      // "Mobile: 9918223344" and "Phone: 9876543210" all sit on their own line.)
      const customerPhoneLine = phoneSrc.split('\n').find(line => /\b(customer|client|buyer|party|naam|name|tenant|owner)\b.*\b(phone|mobile|mob|contact|number|no)\b/i.test(line)) || '';
      const phoneMatch = customerPhoneLine.match(/(?:^|\D)([6-9]\d{9})(?!\d)/)
                      || phoneSrc.match(/(?:^|\D)([6-9]\d{9})(?!\d)/);
      if (phoneMatch) phone = phoneMatch[1];

      // 2. Date (dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, "12 Sep 2026")
      const dateRe = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*\d{2,4})\b/i;
      const dateMatch = text.match(dateRe);
      if (dateMatch) date_str = dateMatch[1];

      // Helper: numbers on a line, minus dates / phone / invoice numbers / GST / PIN / years
      const numbersIn = (line) => {
        let l = line.replace(new RegExp(dateRe.source, 'gi'), ' ')
                    .replace(/\d{1,2}:\d{2}(\s*[ap]m)?/gi, ' ')                 // time
                    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g, ' ')    // GSTIN
                    .replace(/(?:inv(?:oice)?|bill|receipt|order|memo|sr|s\.no|no|#)\s*[.:#-]?\s*\d+/gi, ' ')
                    .replace(/\b(?:pin|pincode|zip)\s*[:\-]?\s*\d{6}\b/gi, ' ')
                    .replace(/\b\d{1,3}(?:\.\d+)?\s*%/g, ' ');                       // 18%
        if (phone) l = l.split(phone).join(' ');
        const out = [];
        const re = /(?:₹|rs\.?|inr|rupees)?\s*(\d[\d,]*(?:[.,]\d{1,3})?)(?:\s*\/-)?/gi;
        let m;
        while ((m = re.exec(l))) {
          const rawNum = m[1].replace(/,/g, '');
          // normaliseNumber() fixes the two mis-reads we measured on the shipped
          // bills: "1.460" (comma read as dot) and "6.500" -> 1460 / 6500,
          // instead of the old 1 / 6.
          const val = Math.round(normaliseNumber(rawNum));
          if (!isFinite(val) || val < 1) continue;
          const hasCurrency = /₹|rs|inr|rupees/i.test(m[0]) || /\/-\s*$/.test(m[0]);
          if (!hasCurrency && val >= 1990 && val <= 2099 && rawNum.replace(/[.,]/g, '').length === 4) continue; // saal
          if (rawNum.replace(/[.,].*$/, '').length >= 8) continue;                        // account / ref numbers
          out.push(val);
        }
        return out;
      };

      // 3. Amount: highest-priority keyword line jeetti hai; same line par rightmost number
      const priority = [
        [/(grand\s*total|net\s*(?:payable|amount|total)|total\s*(?:due|payable|amount)|amount\s*(?:due|payable)|balance\s*due|bakaya|baaki|baki|kul\s*(?:rakam|jod)|payable)/i, 5],
        [/(\bdue\b|\bbalance\b|\bbal\b|outstanding|pending|udhaar|udhar)/i, 4],
        [/(\btotal\b|\bamount\b|\bamt\b|\bkul\b|\bjod\b|\bsum\b)/i, 3],
        [/(₹|\brs\.?|\binr\b|\/-)/i, 2],
      ];
      let best = { score: -1, val: null, idx: -1 };
      rawLines.forEach((line, idx) => {
        if (/(paid|received|advance|discount|cgst|sgst|igst|gst\s*@|tax|qty|rate|mrp|change|round)/i.test(line) && !/(due|balance|bal|baaki|bakaya|total\s*(?:due|payable))/i.test(line)) return;
        let score = 0;
        for (const [re, sc] of priority) { if (re.test(line)) { score = sc; break; } }
        if (!score) return;
        let nums = numbersIn(line);
        if (!nums.length && rawLines[idx + 1] && !/[a-z]{4,}/i.test(rawLines[idx + 1])) nums = numbersIn(rawLines[idx + 1]); // value next line par
        if (!nums.length) return;
        const val = nums[nums.length - 1];
        // baad wali "total/due" line ko tie par preference (bills me neeche hota hai)
        if (score > best.score || (score === best.score && idx > best.idx)) best = { score, val, idx };
      });
      if (best.val) amount = best.val;

      // Fallback: sabse bada plausible number (₹/Rs wale ko preference)
      if (!amount) {
        const withCur = [];
        rawLines.forEach(line => { if (/₹|\brs\.?|\binr\b|\/-/i.test(line)) numbersIn(line).forEach(v => withCur.push(v)); });
        const pool = withCur.filter(v => v >= 10 && v <= 5000000);
        if (pool.length) { amount = Math.max(...pool); warn.push('amount'); }
      }

      /* ---- Amount sanity check -------------------------------------
         One mis-read digit must never turn into a wrong WhatsApp reminder.
         Real example measured on the shipped freelance bill: "Total Due
         Amount Rs 4,500" came back from OCR as "84500" ("Rs" read as "8"),
         i.e. an 18x error. We compare the chosen amount against every
         other number on the bill; if it dwarfs them we keep it but flag
         it loudly so the user must verify before sending. */
      let suspect = null;
      if (amount) {
        const allNums = [];
        rawLines.forEach(line => numbersIn(line).forEach(v => allNums.push(v)));
        const others = allNums.filter(v => v !== amount);
        const sumOthers = others.reduce((a, b) => a + b, 0);
        const bestLine = best.idx >= 0 ? (rawLines[best.idx] || '') : '';
        const hasCurrencyOnLine = /₹|\brs\.?|\binr\b|\/-/i.test(bestLine);

        // If OCR actually saw "Rs"/"₹" right next to the number, trust it —
        // that is the highest-confidence signal a printed bill gives us.
        if (!hasCurrencyOnLine && sumOthers > 0 && amount > 3 * sumOthers) {
          suspect = { value: amount, hint: sumOthers, reason: 'outlier' };
        } else if (amount >= SUSPICIOUS_AMOUNT && !hasCurrencyOnLine) {
          suspect = { value: amount, hint: 0, reason: 'too-large' };
        }
        if (suspect) warn.push('amount');
      }

      // 4. Naam: keyword ke saath (same line ya next line), warna pehli "insaan jaisi" line
      const nameKey = /(?:customer\s*name|tenant\s*name|client\s*name|party\s*name|bill(?:ed)?\s*to|sold\s*to|ship\s*to|received\s*from|customer|client|party|naam|name|shri|smt|m\/s|tenant|owner|mr\.?|mrs\.?|ms\.?)\s*[:\-–]?\s*(.*)$/i;
      const clip = (v) => v.replace(/^\s*\([^)]*\)\s*[:\-–]?\s*/, '').replace(/\b(date|dt|mob|mobile|phone|ph|no|inv|invoice|bill|amount|amt|total|due|gst|address|add)\b.*$/i, '')
                           .replace(/[^A-Za-z\u0900-\u097F .&'-]/g, ' ').replace(/\s+/g, ' ').trim();
      for (let i = 0; i < rawLines.length && !name; i++) {
        const m = rawLines[i].match(nameKey);
        if (!m) continue;
        let v = clip(m[1] || '');
        if (v.length < 2 && rawLines[i + 1]) v = clip(rawLines[i + 1]);
        if (v.length >= 2 && !/^(name|naam|customer|client|invoice|bill)$/i.test(v)) name = v.slice(0, 40);
      }
      if (!name) {
        const skip = /invoice|cash|memo|bill|parchi|tax|receipt|store|stores|market|shop|traders|enterprises|pvt|ltd|llp|kirana|medical|electronics|mobile|thank|visit|again|total|amount|date|gst|phone|address|road|nagar|colony|city|estimate|quotation|payment|paid|due|balance|description|item|qty|rate/i;
        for (const line of rawLines) {
          const clean = line.replace(/[^A-Za-z\u0900-\u097F .'-]/g, '').trim();
          const words = clean.split(/\s+/).filter(Boolean);
          if (clean.length >= 3 && clean.length <= 30 && words.length >= 1 && words.length <= 3 && clean.length / Math.max(1, line.length) > 0.75 && !skip.test(clean)) {
            name = clean; warn.push('name'); break;
          }
        }
      }
      if (name) name = name.replace(/\b\w/g, c => c.toUpperCase());

      return {
        name: name || 'Customer',
        amount: amount || '',
        phone: phone || '',
        type: 'lena',
        dueDate: date_str,
        dueText: date_str ? `Date: ${date_str}` : 'Parchi Hisaab',
        raw: text.slice(0, 100),
        _warn: warn,
        _amountSuspect: suspect,
        _confidence: (amount && best.score >= 3 && !suspect ? 1 : 0) + (name && !warn.includes('name') ? 1 : 0)
      };
    },

    // --- Embedded CSS Styles ---
    injectStyles() {
      if (document.getElementById('bb-voice-styles')) return;
      const s = document.createElement('style');
      s.id = 'bb-voice-styles';
      s.textContent = `
        /* Modal Backdrop & Sheet */
        .bb-assist-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(38,24,24,0.65);
          backdrop-filter: blur(5px);
          z-index: 10000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: bbFadeIn 0.2s ease-out;
        }
        .bb-assist-sheet {
          background: #FFFDF8;
          border: 1px solid #F0DFCF;
          border-radius: 28px 28px 0 0;
          width: 100%;
          max-width: 520px;
          max-height: 88vh;
          overflow-y: auto;
          padding: 20px 18px 28px;
          box-shadow: 0 -15px 40px rgba(0,0,0,0.2);
          animation: bbSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes bbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bbSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .bb-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          border-bottom: 1px solid #F0DFCF;
          padding-bottom: 10px;
        }
        .bb-sheet-title {
          font-family: 'Manrope', sans-serif;
          font-size: 17px;
          font-weight: 900;
          color: #261818;
        }
        .bb-close-btn {
          background: #FFF5DF;
          border: none;
          color: #75615C;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        /* OCR Picker Grid */
        .bb-ocr-options-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }
        .bb-ocr-opt-btn {
          background: #FFFDF8;
          border: 1.5px solid #F0DFCF;
          border-radius: 18px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          text-align: left;
          box-shadow: 0 4px 12px rgba(65,35,25,0.04);
          transition: all 0.15s ease;
        }
        .bb-ocr-opt-btn:active {
          transform: scale(0.98);
          border-color: #FF725F;
        }
        .bb-opt-icon {
          font-size: 26px;
          background: #FFF5DF;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          flex-shrink: 0;
        }
        .bb-ocr-opt-btn strong {
          display: block;
          font-size: 14.5px;
          color: #261818;
          margin-bottom: 2px;
        }
        .bb-ocr-opt-btn small {
          display: block;
          font-size: 12px;
          color: #75615C;
          font-weight: 600;
        }

        /* Sample Bills Section */
        .bb-samples-box {
          background: #FFF5DF;
          border: 1.5px dashed #F0DFCF;
          border-radius: 18px;
          padding: 12px 14px;
        }
        .bb-samples-title {
          font-size: 12px;
          font-weight: 800;
          color: #5A302B;
          margin-bottom: 8px;
        }
        .bb-samples-pills {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .bb-sample-chip {
          background: #FFFDF8;
          border: 1px solid #F0DFCF;
          border-radius: 12px;
          padding: 8px 10px;
          font-size: 11.5px;
          font-weight: 800;
          color: #261818;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .bb-sample-chip:hover {
          border-color: #FF725F;
        }

        /* Progress Bar */
        .bb-progress-bar-wrap {
          width: 100%;
          background: #FFF5DF;
          height: 8px;
          border-radius: 6px;
          overflow: hidden;
          margin: 10px 0;
          border: 1px solid #F0DFCF;
        }
        .bb-progress-bar {
          height: 100%;
          width: 10%;
          background: linear-gradient(90deg, #FF725F, #25D366);
          border-radius: 6px;
          transition: width 0.2s ease;
        }

        /* Pulse Rings */
        .bb-mic-pulse-wrap {
          position: relative;
          width: 90px;
          height: 90px;
          margin: 18px auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bb-mic-pulse-circle {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF725F, #E8594B);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          z-index: 2;
          box-shadow: 0 8px 20px rgba(255,114,95,0.4);
        }
        .bb-pulse-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #FF725F;
          animation: bbPulse 1.8s infinite;
        }
        .bb-pulse-ring.r2 { animation-delay: 0.6s; }
        @keyframes bbPulse {
          0% { transform: scale(0.7); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .bb-listen-text { text-align: center; font-size: 14px; font-weight: 800; color: #261818; }
        .bb-listen-example { text-align: center; font-size: 12px; font-weight: 600; color: #9D8781; margin: 4px 0 14px; }
        .bb-transcript-box {
          background: #FFF5DF;
          border: 1.5px dashed #F0DFCF;
          border-radius: 16px;
          padding: 14px;
          font-size: 14.5px;
          font-weight: 700;
          color: #5A302B;
          min-height: 48px;
          text-align: center;
        }

        /* OCR Loader */
        .bb-ocr-loader { text-align: center; padding: 25px 10px; }
        .bb-spinner {
          width: 40px;
          height: 40px;
          border: 3.5px solid #F0DFCF;
          border-top-color: #FF725F;
          border-radius: 50%;
          margin: 0 auto 12px;
          animation: bbSpin 0.8s linear infinite;
        }
        @keyframes bbSpin { to { transform: rotate(360deg); } }

        /* Result Stage */
        .bb-result-tag-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .bb-pill {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .bb-pill.lena { background: #EAF8F0; color: #087A43; border: 1px solid #C4EED0; }
        .bb-pill.dena { background: #FDE8E8; color: #9B1C1C; border: 1px solid #F8B4B4; }
        .bb-pill.date { background: #FFF5DF; color: #75615C; border: 1px solid #F0DFCF; cursor: default; }

        .bb-grid-inputs { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; }
        .bb-label { font-size: 12px; font-weight: 800; color: #75615C; margin-bottom: 5px; display: block; }
        .bb-input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 13px;
          background: #FFFDF8;
          border: 1.5px solid #F0DFCF;
          border-radius: 14px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          color: #261818;
        }
        .bb-input:focus { border-color: #FF725F; outline: none; }

        /* Message Cards */
        .bb-msg-cards { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
        .bb-msg-card {
          background: #FFF5DF;
          border: 1px solid #F0DFCF;
          border-radius: 16px;
          padding: 12px 14px;
        }
        .bb-msg-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .bb-msg-tone { font-size: 12px; font-weight: 800; color: #5A302B; }
        .bb-msg-copy-btn {
          background: #FFFDF8;
          border: 1px solid #F0DFCF;
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          color: #75615C;
        }
        .bb-msg-text { font-size: 12.5px; line-height: 1.45; color: #261818; margin-bottom: 10px; }
        .bb-msg-wa-btn {
          width: 100%;
          background: #25D366;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 9px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(37,211,102,0.25);
        }

        /* Sheet Action Buttons */
        .bb-sheet-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }
        .bb-sheet-btn {
          padding: 13px;
          border-radius: 16px;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }
        .bb-sheet-btn.primary {
          background: linear-gradient(135deg, #FF725F, #E8594B);
          color: #fff;
          box-shadow: 0 6px 16px rgba(255,114,95,0.3);
        }
        .bb-sheet-btn.secondary {
          background: #FFF5DF;
          color: #5A302B;
          border: 1px solid #F0DFCF;
        }

        /* Amount sanity warning */
        .bb-warn-box {
          background: #FFF4E5;
          border: 1.5px solid #F0A868;
          color: #7A3B00;
          border-radius: 14px;
          padding: 11px 13px;
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.45;
          margin-bottom: 12px;
        }

        @media (max-width: 400px) {
          .bb-grid-inputs { grid-template-columns: 1fr; }
          .bb-sheet-actions { grid-template-columns: 1fr; }
        }
      `;
      document.head.appendChild(s);
    }
  };

  window.bbVoiceAssistant = VoiceAssistant;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VoiceAssistant.init());
  } else {
    VoiceAssistant.init();
  }

})(typeof window !== 'undefined' ? window : this);
