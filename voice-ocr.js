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
        return '🎙️ Mic permission nahi mili. Browser ke 🔒 icon se microphone allow karein, phir dobara tap karein.';
      case 'service-not-allowed':
        return '🎙️ Browser ki speech service block hai. Chrome/Edge use karein ya settings me speech recognition on karein.';
      case 'no-speech':
        return '🎙️ Kuch sunayi nahi diya. Thoda zor se bolein — dobara try kar raha hoon.';
      case 'audio-capture':
        return '🎙️ Mic device nahi mila. Mic/headset check karein, ya koi doosra app mic use to nahi kar raha.';
      case 'network':
        return '🎙️ Voice ke liye internet chahiye (speech Google server pe process hoti hai). Connection check karein.';
      case 'aborted':
        return '🎙️ Voice band ho gayi. Dobara tap karke bolein.';
      case 'language-not-supported':
        return '🎙️ Ye browser Hindi/Hinglish speech support nahi karta. Neeche type karke bhi likh sakte hain.';
      default:
        return '🎙️ Mic me dikkat aayi (' + code + '). Dobara tap karein, ya neeche type karke likhein.';
    }
  }

  // Escape a string for safe use inside a RegExp
  function rxEsc(s){ return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // --- NLP & Extraction Helpers ---

  function cleanSpokenText(t){
    return String(t || '').trim().replace(/[\.,\?!।]/g, ' ');
  }
  /* Local calendar date (YYYY-MM-DD). Never toISOString() — between local
     midnight and 05:30 IST the UTC day is still yesterday. */
  function localISODate(d){
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  /* Hindi/Hinglish spoken-number vocabulary. Composition follows Indian
     grouping: "ek hazar paanch sau" = 1×1000 + 5×100 = 1500. */
  const HINDI_NUMBER_WORDS = {
    'ek': 1, 'एक': 1, 'do': 2, 'doo': 2, 'दो': 2, 'teen': 3, 'तीन': 3, 'char': 4, 'चार': 4,
    'panch': 5, 'paanch': 5, 'पांच': 5, 'chhe': 6, 'chhah': 6, 'che': 6, 'छह': 6,
    'saat': 7, 'सात': 7, 'aath': 8, 'आठ': 8, 'nau': 9, 'नौ': 9, 'das': 10, 'दस': 10,
    'gyarah': 11, 'gyara': 11, 'ग्यारह': 11, 'barah': 12, 'बारह': 12, 'terah': 13, 'तेरह': 13,
    'chaudah': 14, 'चौदह': 14, 'pandrah': 15, 'pandra': 15, 'पंद्रह': 15, 'solah': 16, 'सोलह': 16,
    'satrah': 17, 'सत्रह': 17, 'atharah': 18, 'अठारह': 18, 'unnis': 19, 'उन्नीस': 19,
    'bees': 20, 'बीस': 20, 'tees': 30, 'तीस': 30, 'chalis': 40, 'चालीस': 40,
    'pachaas': 50, 'पचास': 50, 'saath': 60, 'साठ': 60, 'sattar': 70, 'सत्तर': 70,
    'assi': 80, 'अस्सी': 80, 'nabbe': 90, 'नब्बे': 90,
    'dedh': 1.5, 'डेढ़': 1.5, 'dhai': 2.5, 'ढाई': 2.5, 'adha': 0.5, 'aadha': 0.5, 'आधा': 0.5
  };
  const HINDI_MULTIPLIERS = {
    'sau': 100, 'सौ': 100,
    'hazar': 1000, 'hazaar': 1000, 'हजार': 1000, 'हज़ार': 1000, 'k': 1000,
    'lakh': 100000, 'लाख': 100000
  };
  const CURRENCY_WORD_RE = /(rupaye|rupya|rupees|rs\.?|₹|inr)/i;
  /* Spans that look like money but are dates, day-numbers or phone numbers.
     "Ravi 15 ko 500 dena hai" must never parse as ₹15. */
  const NON_MONEY_SPANS = [
    /\b\d{1,2}\s*(?:ko|tarikh|tareekh|tareeq)\b/gi,
    /\d{1,2}\s*(?:को|तारीख|तरीख)/g,                                        // "15 को"
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,
    /\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*\d{2,4}\b/gi,
    /(?:\+?91[\s-]?)?[6-9]\d{9}/g
  ];
  function stripNonMoneySpans(s) {
    let out = String(s || '');
    for (const re of NON_MONEY_SPANS) out = out.replace(re, ' ');
    return out;
  }
  function composeSpokenNumber(tokens) {
    let total = 0, current = 0, used = false;
    for (const t of tokens) {
      if (t.m != null) { current = (current || 1) * t.m; total += current; current = 0; used = true; }
      else { current += t.v; used = true; }
    }
    return used ? total + current : null;
  }
  function roundMoney2(n) {
    const v = Number(n);
    if (!isFinite(v)) return null;
    return typeof bbRoundMoney === 'function' ? bbRoundMoney(v) : Math.round(v * 100) / 100;
  }

  /* `exclude` = a substring that must never be read as money (a 10-digit
     phone number the caller already picked out of the same sentence). */
  function extractAmountFromText(text, exclude){
    let src = String(text || '');
    if (exclude) src = src.split(exclude).join(' ');
    const moneySrc = stripNonMoneySpans(src);
    // Lowercase only — cleanSpokenText() would strip the dot in "1450.75".
    const cleanMoney = moneySrc.toLowerCase();

    // 1. Spoken numbers ("ek hazar paanch sau", "दो हजार", "2.5 hazar", "5k").
    //    Only trusted when the phrase actually carries a multiplier or a
    //    currency word — otherwise stray words like "kar do" read as ₹2.
    const tokenRe = /(\d+(?:[.,]\d+)?)|([a-z\u0900-\u097F]+)/gi;
    const tokens = [];
    let tm;
    while ((tm = tokenRe.exec(cleanMoney))) {
      if (tm[1] != null) {
        const v = normaliseNumber(tm[1]);
        if (v != null) tokens.push({ v });
      } else {
        const w = tm[2].toLowerCase();
        if (HINDI_MULTIPLIERS[w] != null) tokens.push({ m: HINDI_MULTIPLIERS[w] });
        else if (HINDI_NUMBER_WORDS[w] != null) tokens.push({ v: HINDI_NUMBER_WORDS[w] });
      }
    }
    if (tokens.some(t => t.m != null) || (CURRENCY_WORD_RE.test(cleanMoney) && tokens.length)) {
      const composed = composeSpokenNumber(tokens);
      if (composed != null && composed > 0) {
        const rounded = roundMoney2(composed);
        if (rounded != null && rounded > 0) return rounded;
      }
    }

    // 2. Direct plain digits like "200", "1200", "₹500", "1,450.00".
    //    Paise (≤2 decimals) are preserved; 3-decimal groups were already
    //    collapsed to thousands by normaliseNumber().
    const digitMatch = moneySrc.match(/(?:₹|rs\.?|inr|rupees)?\s*(\d[\d,]*(?:[.,]\d{1,3})?)/i);
    if (digitMatch) {
      const parsed = normaliseNumber(digitMatch[1]);
      if (parsed != null && parsed > 0) {
        const rounded = roundMoney2(parsed);
        if (rounded != null && rounded > 0) return rounded;
      }
    }
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
      const tmrw = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      dueDate = localISODate(tmrw);
      dueText = 'Kal tak';
    } else if (/(aaj|today|आज)/i.test(clean)) {
      dueDate = localISODate(now);
      dueText = 'Aaj tak';
    } else if (/(parso|परसों)/i.test(clean)) {
      const p = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
      dueDate = localISODate(p);
      dueText = 'Parso tak';
    } else {
      // "15 tarikh" has no month/year — shown as text only, never persisted
      // as a due date. The review checkbox is the confirmation step.
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

          // An explicit user cancel is final — never auto-restart the mic.
          if (this._userCancelled) {
            this._pendingRetryLang = null;
            this.updateTranscriptUI('🎙️ Voice band kar di.');
            this._holdUi = true;
            setTimeout(() => { this._holdUi = false; this.hideListeningUI(); }, 1200);
            return;
          }

          // Nothing heard / language unsupported? Try once more in the other
          // language before giving up. The retry language is remembered so a
          // racing onend cannot reset it back to the primary language.
          if ((e.error === 'no-speech' || e.error === 'aborted' || e.error === 'language-not-supported') && this.langIndex === 0) {
            this.langIndex = 1;
            this._pendingRetryLang = SPEECH.fallback;
            this.updateTranscriptUI(micErrorMessage(e.error));
            this._holdUi = true;
            setTimeout(() => {
              this._holdUi = false;
              try {
                if (this.recognition) this.recognition.lang = this._pendingRetryLang || SPEECH.primary;
                this._pendingRetryLang = null;
                this.recognition.start();
              } catch (_) { this.hideListeningUI(); }
            }, 900);
            return;
          }

          this._pendingRetryLang = null;
          this._holdUi = true;                       // keep the sheet up so it can be read
          this.updateTranscriptUI(micErrorMessage(e.error));
          setTimeout(() => { this._holdUi = false; this.hideListeningUI(); }, 3400);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          // Back to the primary language for the NEXT utterance — but never
          // while a fallback retry is still pending (it must run in en-IN).
          if (!this._pendingRetryLang) {
            this.langIndex = 0;
            if (this.recognition) this.recognition.lang = SPEECH.primary;
          }
          // NOTE: _userCancelled is deliberately NOT cleared here — browsers
          // fire onend/onerror in different orders, and clearing it in onend
          // let a racing 'aborted' error restart the mic after Cancel. It is
          // reset when the user starts the next session (_startRecognition).
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
        toast('🎙️ Is browser me voice support nahi hai (Firefox/Safari purane version). Chrome ya Edge use karein — neeche type karke bhi likh sakte hain.');
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
            toast('🎙️ Mic permission block hai. Browser ke 🔒 icon se microphone allow karein, phir dobara tap karein.');
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
      this._userCancelled = false;
      this._pendingRetryLang = null;
      this.langIndex = 0;
      if (this.recognition) this.recognition.lang = SPEECH.primary;
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
      // Mark as user-initiated so the resulting 'aborted' error can never
      // trigger the no-speech fallback retry (mic restarting after Cancel).
      this._userCancelled = true;
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
        toast('Khata load nahi hua. Page refresh karke dobara try karein.');
        return;
      }
      const target = this.findKhataByName(name);
      if (target) {
        // Destructive + voice input is imperfect => confirm, then offer undo.
        const amt = target.amount ? '₹' + Number(target.amount).toLocaleString('en-IN') : 'pura hisaab';
        if (!window.confirm(`${target.name} ka hisaab (${amt}) "paid" mark karein?`)) {
          this.updateTranscriptUI('Cancel kar diya — kuch change nahi hua.');
          return;
        }
        // Full snapshot (incl. transactions[]) so undo restores the ledger
        // event too — not just three summary fields.
        const snapshot = JSON.stringify(target);
        const outstanding = typeof window.outstandingAmount === 'function'
          ? window.outstandingAmount(target)
          : Math.max((Number(target.amount) || 0) - (Number(target.paidAmount) || 0), 0);
        if (Array.isArray(target.transactions)) {
          // Canonical path: settle through the transaction ledger.
          if (outstanding > 0) {
            target.transactions.push({
              id: 'tx-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              type: 'received',
              amount: outstanding,
              date: localISODate(new Date()),
              note: 'Voice: hisaab clear',
              mode: 'Other',
              createdAt: Date.now()
            });
          }
          if (typeof window.syncKhataFromLedger === 'function') {
            window.syncKhataFromLedger(target);
          } else {
            target.status = 'paid';
            target.paidAmount = target.amount;
          }
        } else {
          // Legacy row without a ledger yet.
          target.status = 'paid';
          target.paidAmount = target.amount;
        }
        target.updatedAt = Date.now();
        if (typeof window.persist === 'function') window.persist();
        toast(`✅ ${target.name} ka hisaab clear kar diya gaya!`);
        if (typeof window.bbShowUndo === 'function') {
          window.bbShowUndo('Hisaab clear hua', () => {
            const fresh = JSON.parse(snapshot);
            Object.keys(target).forEach(k => { delete target[k]; });
            Object.assign(target, fresh);
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
        toast('Khata load nahi hua. Page refresh karke dobara try karein.');
        return;
      }
      const target = this.findKhataByName(name);
      if (target) {
        // Remind for what is actually outstanding — never the gross original
        // amount after a partial payment, and never on a cleared entry.
        const due = typeof window.outstandingAmount === 'function'
          ? window.outstandingAmount(target)
          : Math.max((Number(target.amount) || 0) - (Number(target.paidAmount) || 0), 0);
        if (!due || due <= 0 || target.status === 'paid') {
          this.updateTranscriptUI(`✅ ${target.name} ka hisaab already clear hai — reminder ki zarurat nahi.`);
          return;
        }
        this.activeEntry = {
          name: target.name,
          amount: due,
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
        <!-- Floating FAB Assistant (Compact, Clean, No overlap) -->
        <div id="bb-fab-assistant" class="bb-fab-group">
          <button class="bb-fab-btn bb-fab-camera" onclick="bbVoiceAssistant.openOcrPicker()"
                  title="Scan Bill / Parchi / Photo" aria-label="Bill ya parchi scan karein">
            <span>📷</span>
          </button>
          <button class="bb-fab-btn bb-fab-mic" id="bb-fab-mic" onclick="bbVoiceAssistant.startVoice()"
                  title="Bolkar Hisaab Likhein" aria-label="Bolkar hisaab likhein">
            <span class="bb-fab-icon">🎙️</span>
            <span class="bb-fab-label">Bolkar Likhein</span>
          </button>
        </div>

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
                Dukaan ki kachi parchi, notebook ya printed invoice scan karein:
              </p>

              <div class="bb-ocr-options-grid">
                <button class="bb-ocr-opt-btn" onclick="bbVoiceAssistant.triggerDirectCamera()">
                  <span class="bb-opt-icon">📸</span>
                  <div>
                    <strong>Camera Se Photo Lo</strong>
                    <small>Live bill ya parchi ki photo khechein</small>
                  </div>
                </button>
                <button class="bb-ocr-opt-btn" onclick="bbVoiceAssistant.triggerGalleryUpload()">
                  <span class="bb-opt-icon">📁</span>
                  <div>
                    <strong>Gallery / File Upload</strong>
                    <small>Pehle se khinchi hui photo ya bill chunein</small>
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
              <div class="bb-listen-text">Sun raha hoon... Aise bolein:</div>
              <div class="bb-listen-example">"Ravi se 500 lena hai kal tak" ya "9918000099"</div>
              <div id="bb-voice-transcript" class="bb-transcript-box">Listening...</div>
              <button class="bb-sheet-btn secondary" style="margin-top:14px;" onclick="bbVoiceAssistant.stopVoice()">Stop / Cancel</button>
            </div>

            <!-- OCR Processing Stage with Live Progress Bar -->
            <div id="bb-stage-ocr" style="display:none;">
              <div class="bb-ocr-loader">
                <div class="bb-spinner"></div>
                <p id="bb-ocr-status-text">📷 Parchi scan ho rahi hai...</p>
                <div class="bb-progress-bar-wrap">
                  <div id="bb-ocr-progress-bar" class="bb-progress-bar"></div>
                </div>
                <small id="bb-ocr-progress-sub">Pehli baar ~2 MB OCR engine download hoga — uske baad offline chalega</small>
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

              <div style="margin-top:10px;">
                <label class="bb-label">Due Date</label>
                <input type="date" id="bb-edit-date" class="bb-input" oninput="bbVoiceAssistant.syncActiveEntry()" />
                <div id="bb-date-source" style="font-size:11px;color:var(--text-muted);font-weight:600;margin-top:4px;"></div>
              </div>

              <!-- Mandatory human review before anything financial leaves the app -->
              <label id="bb-review-row" style="display:flex;gap:9px;align-items:flex-start;margin:16px 0 0;font-size:13px;font-weight:700;line-height:1.45;cursor:pointer;">
                <input type="checkbox" id="bb-review-confirm" style="margin-top:2px;width:17px;height:17px;flex:none;" onchange="bbVoiceAssistant.setReviewed(this.checked)" />
                <span>Maine <b>naam</b>, <b>₹ amount</b>, <b>Lena/Dena</b>, <b>mobile number</b> aur <b>due date</b> check kar liye — ye details sahi hain.</span>
              </label>
              <div id="bb-review-hint" style="display:none;margin-top:6px;font-size:12px;font-weight:700;color:#B45309;">⚠️ Save / Copy / WhatsApp se pehle ye details verify karein.</div>

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

      // Do not advertise a mic that cannot work (Firefox, older Safari).
      if (!this.micSupported) {
        const micFab = document.getElementById('bb-fab-mic');
        if (micFab) micFab.style.display = 'none';
      }

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
      this.updateTranscriptUI('Sun raha hoon... Bolna shuru kijiye');
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

      head.textContent = entry._manual ? '✍️ Manual Entry — scan complete nahi hua' : entry._lowConfidence ? '📷 Scan unclear — details bharo' : entry._isOcr ? (entry._confidence >= 2 ? '📷 Scan result — details verify karo' : '📷 Scan hua — ek baar check karo') : '🎙️ Entry Samjhi Gayi!';
      if (entry._isOcr && entry._confidence < 2 && typeof window.showToast === 'function') window.showToast('Scan ki details verify karke hi save karein.');
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

      // Due date: editable input + honest source label. OCR only ever fills
      // this from an explicit "Due Date" line; otherwise it stays blank.
      const dateInput = document.getElementById('bb-edit-date');
      if (dateInput) dateInput.value = entry.dueDate || '';
      const dateSource = document.getElementById('bb-date-source');
      if (dateSource) {
        const src = entry._dateSource;
        dateSource.textContent = src === 'bill-due-label'
          ? '📅 Bill ki "Due Date" line se — phir bhi ek baar dekh lein'
          : src === 'bill-invoice-date'
            ? `📅 Bill par due date nahi mila (${entry.dueText ? entry.dueText.replace(' — due date nahi mila', '') : 'koi date nahi'}). Zaroorat ho toh aap daalein.`
            : '📅 Aap khud daal sakte hain (ya khali chhod dein)';
      }

      // Human review gate — nothing financial is sent/saved until checked.
      const reviewBox = document.getElementById('bb-review-confirm');
      if (reviewBox) reviewBox.checked = false;
      this._reviewed = false;
      const reviewHint = document.getElementById('bb-review-hint');
      if (reviewHint) reviewHint.style.display = 'block';

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
      // Direction changed — the previous review no longer covers this entry.
      this._reviewed = false;
      const reviewBox = document.getElementById('bb-review-confirm');
      if (reviewBox) reviewBox.checked = false;
      const reviewHint = document.getElementById('bb-review-hint');
      if (reviewHint) reviewHint.style.display = 'block';
      this.renderMessageCards(this.activeEntry);
    },

    syncActiveEntry() {
      if (!this.activeEntry) return;
      const before = JSON.stringify([this.activeEntry.name, this.activeEntry.amount, this.activeEntry.phone, this.activeEntry.dueDate]);
      this.activeEntry.name = document.getElementById('bb-edit-name').value.trim();
      this.activeEntry.amount = document.getElementById('bb-edit-amount').value.trim();
      this.activeEntry.phone = document.getElementById('bb-edit-phone').value.trim();
      const dateInput = document.getElementById('bb-edit-date');
      if (dateInput) this.activeEntry.dueDate = dateInput.value || '';
      const after = JSON.stringify([this.activeEntry.name, this.activeEntry.amount, this.activeEntry.phone, this.activeEntry.dueDate]);
      if (before !== after) {
        // A field actually changed — the previous review no longer covers it.
        if (this.activeEntry.dueDate && dateInput && dateInput.value) this.activeEntry._dateSource = 'user';
        const src = document.getElementById('bb-date-source');
        if (src && this.activeEntry.dueDate) src.textContent = '📅 Aapne ye date daali';
        this._reviewed = false;
        const reviewBox = document.getElementById('bb-review-confirm');
        if (reviewBox) reviewBox.checked = false;
        const reviewHint = document.getElementById('bb-review-hint');
        if (reviewHint) reviewHint.style.display = 'block';
      }
      this.renderMessageCards(this.activeEntry);
    },

    /* ---- Mandatory human review gate ----------------------------------
       A wrong amount / recipient is the one OCR-or-voice mistake that
       actually costs money. Save, Copy, WhatsApp and Vasooli handoff stay
       locked until the user explicitly confirms the parsed details, and any
       later edit re-locks them. */
    setReviewed(v) {
      this._reviewed = !!v;
      const hint = document.getElementById('bb-review-hint');
      if (hint) hint.style.display = this._reviewed ? 'none' : 'block';
      if (this.activeEntry) this.renderMessageCards(this.activeEntry);
    },
    isReviewed() { return !!this._reviewed; },
    requireReview(actionLabel) {
      if (this.isReviewed()) return true;
      toast(`Pehle upar wale checkbox se details verify karein, phir ${actionLabel}.`);
      const cb = document.getElementById('bb-review-confirm');
      if (cb && cb.focus) cb.focus();
      return false;
    },

    renderMessageCards(entry) {
      const container = document.getElementById('bb-msg-cards-container');
      if (!container) return;
      const msgs = this.generateMessageOptions(entry);

      const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const lock = this.isReviewed() ? '' : 'disabled title="Pehle details verify karein"';
      container.innerHTML = msgs.map((m, i) => `
        <div class="bb-msg-card">
          <div class="bb-msg-card-head">
            <span class="bb-msg-tone">${esc(m.tone)}</span>
            <button type="button" class="bb-msg-copy-btn" data-i="${i}" ${lock}>Copy</button>
          </div>
          <div class="bb-msg-text">${esc(m.text)}</div>
          <button type="button" class="bb-msg-wa-btn" data-i="${i}" ${lock}>
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
      if (!this.requireReview('WhatsApp bhejne se pehle')) return;
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
      if (!this.requireReview('copy karne se pehle')) return;
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
      if (!this.requireReview('Khata me save karne se pehle')) return;
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
        toast('Khata load nahi hua. Page refresh karke dobara try karein.');
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
      if (!this.requireReview('Vasooli Mode kholne se pehle')) return;
      this.syncActiveEntry();
      const entry = this.activeEntry;
      if (!entry) return;

      if (!window.state) {
        toast('Khata load nahi hua. Page refresh karke dobara try karein.');
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
        toast('📷 Ye photo format support nahi hai (HEIC/PDF nahi). JPG, PNG ya WEBP bhejein — iPhone me Settings → Camera → "Most Compatible" chunein.');
        input.value = '';
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast('📷 Photo bahut badi hai (15 MB limit). Camera se dobara khechein ya screenshot use karein.');
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
      statusText.textContent = 'Image optimize ho rahi hai...';
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
        statusText.textContent = 'OCR engine load ho raha hai...';
        progressBar.style.width = '25%';
        progressSub.textContent = 'Pehli baar ~2 MB — uske baad bina internet chalega';
        await this.loadEngine();
        if (cancelled || this._ocrRunId !== runId) return;
        if (this._ocrRunId !== runId) return;
        statusText.textContent = 'Parchi scan ho rahi hai...';
        progressBar.style.width = '45%';
        progressSub.textContent = 'Naam aur amount dhoondh rahe hain';

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
          msg = '⏳ Scan me bahut time lag raha hai. Chhoti/seedhi photo se dobara try karein.';
        } else if (err && err.message === 'OCR_EMPTY') {
          msg = '📷 Parchi se koi text nahi mila. Achhi roshni me, seedha photo khechein.';
        } else if (err && err.message === 'OFFLINE_OCR') {
          msg = '📶 Pehli baar OCR engine download karne ke liye internet chahiye. Abhi manual entry kar lijiye.';
        } else if (err && /IMAGE_(READ|DECODE|ENCODE)_FAILED|ENGINE_LOAD_FAILED/.test(err.message)) {
          msg = '📷 Photo padh nahi paaye. Dusri photo ya screenshot se try karein.';
        } else if (!navigator.onLine) {
          msg = '📶 Internet nahi hai. Pehli baar scan ke liye internet chahiye — abhi manual entry kar lijiye.';
        } else {
          msg = 'OCR scan me dikkat aayi. Kripya manual entry karein.';
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
      if (!navigator.onLine) {
        // A previous scan already cached the engine (CACHE_OCR). A same-origin
        // <script> load can still succeed while offline, so try it before
        // giving up — "works offline after first use" must survive a reload.
        try { await this.loadScript(OCR.engine); } catch (e) { throw new Error('OFFLINE_OCR'); }
        if (!window.Tesseract) throw new Error('OFFLINE_OCR');
        return;
      }
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

      // 1. Mobile number (10-digit, Indian) — also allow "+91 98765 43210" / "98765-43210"
      const phoneSrc = text.replace(/(\+?91[\s-]?)?(\d{5})[\s-](\d{5})/g, (m, c, a, b) => `${a}${b}`);
      const phoneLines = phoneSrc.split('\n');
      const mobileRe = /(?:^|\D)([6-9]\d{9})(?!\d)/;
      const phoneOnLine = (line) => { const m = line.match(mobileRe); return m ? m[1] : ''; };
      // A number only counts as the CUSTOMER's when it is explicitly linked to
      // the customer/party block. The dukaan header's own "Mob:" is NEVER the
      // customer's number — a wrong WhatsApp recipient is worse than no number,
      // so when the link is ambiguous the phone stays blank for the user.
      const customerPhoneLine = phoneLines.find(line => /\b(customer|client|buyer|party|naam|name|tenant)\b.*\b(phone|mobile|mob|contact|number|no)\b/i.test(line)) || '';
      let customerPhone = phoneOnLine(customerPhoneLine);
      if (!customerPhone) {
        // Bills usually print the party's number on its own line ("Phone: 98…")
        // just under the customer-name line. Accept a bare phone line ONLY when
        // it sits inside the customer block (after a customer-name line, and
        // never on a store/header line).
        const storeWordRe = /\b(store|shop|dukaan|dokan|kirana|medical|traders|enterprises|market|from|seller|supplier|vendor|company|pvt|ltd|llp)\b/i;
        const customerWordRe = /\b(customer|client|buyer|party|tenant|billed\s*to|sold\s*to|naam)\b/i;
        let seenCustomerBlock = false;
        for (const line of phoneLines) {
          const isStoreLine = storeWordRe.test(line);
          const isCustomerLine = customerWordRe.test(line) || (/\bname\b/i.test(line) && !isStoreLine);
          if (isCustomerLine) seenCustomerBlock = true;
          if (seenCustomerBlock && !isStoreLine &&
              (isCustomerLine || /\b(phone|mobile|mob|contact|number)\b/i.test(line))) {
            const p = phoneOnLine(line);
            if (p) { customerPhone = p; break; }
          }
        }
      }
      if (customerPhone) phone = customerPhone;

      // 2. Due date — ONLY from an explicitly labelled due line. An invoice
      //    date is not a due date: silently using it moves the reminder.
      //    (dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, "12 Sep 2026")
      const dateRe = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*\d{2,4})\b/i;
      const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const toIsoDate = (line) => {
        const m = line.match(dateRe);
        if (!m) return '';
        const tok = m[1];
        let dd, mm, yy;
        const slash = tok.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
        const word = tok.match(/^(\d{1,2})\s*([a-z]{3,9})\.?,?\s*(\d{2,4})$/i);
        if (slash) { dd = +slash[1]; mm = +slash[2]; yy = +slash[3]; }
        else if (word) {
          dd = +word[1];
          const mon = word[2].toLowerCase();
          mm = MONTHS.findIndex(x => mon.startsWith(x)) + 1;
          if (mon.startsWith('sept')) mm = 9;
          yy = +word[3];
        } else return '';
        if (yy < 100) yy += 2000;
        if (!dd || !mm || !yy || dd > 31 || mm > 12 || yy < 2000 || yy > 2100) return '';
        return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      };
      const dueLabelRe = /(due\s*date|payment\s*due|due\s*(?:by|on|before)|pay\s*(?:by|before)|last\s*date|clear\s*before|due\s*amount\s*date)/i;
      let invoiceDate = '';
      let dateSource = 'none';
      for (const line of rawLines) {
        if (dueLabelRe.test(line)) {
          const iso = toIsoDate(line);
          if (iso) { date_str = iso; dateSource = 'bill-due-label'; break; }
        }
      }
      if (!date_str) {
        // The bill's own date is kept for DISPLAY only — never persisted as
        // the due date.
        for (const line of rawLines) {
          const m = line.match(dateRe);
          if (m) { invoiceDate = m[1]; dateSource = 'bill-invoice-date'; break; }
        }
      }

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
          // Paise are preserved (2 decimals); 3-decimal groups stay the
          // thousands-misread heuristic above.
          const n = normaliseNumber(rawNum);
          const val = typeof bbRoundMoney === 'function' ? bbRoundMoney(n) : Math.round(n * 100) / 100;
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

      // 4. Naam: keyword ke saath (same line ya next line), warna pehli "insaan jaisi" line.
      //    "Owner" is deliberately NOT a customer keyword — on rent receipts the
      //    owner is the merchant (app user); the tenant/buyer is the customer.
      const nameKey = /(?:customer\s*name|tenant\s*name|client\s*name|party\s*name|bill(?:ed)?\s*to|sold\s*to|ship\s*to|received\s*from|customer|client|party|naam|name|shri|smt|m\/s|tenant|mr\.?|mrs\.?|ms\.?)\s*[:\-–]?\s*(.*)$/i;
      const clip = (v) => v.replace(/^\s*\([^)]*\)\s*[:\-–]?\s*/, '').replace(/^[\s.:;,(\-–]+/, '').replace(/^[^A-Za-z\u0900-\u097F]+/, '').replace(/\b(date|dt|mob|mobile|phone|ph|no|inv|invoice|bill|amount|amt|total|due|gst|address|add)\b.*$/i, '')
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
        dueText: date_str
          ? `Due date: ${date_str}`
          : invoiceDate ? `Bill date: ${invoiceDate} — due date nahi mila` : '',
        _dateSource: dateSource,
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
        /* FAB Buttons Group - Clean, Elevated, No Overlap */
        .bb-fab-group {
          position: fixed;
          bottom: 78px;
          right: 14px;
          z-index: 990;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bb-fab-btn {
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          font-weight: 800;
          box-shadow: 0 8px 20px rgba(65,35,25,0.18);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .bb-fab-btn:active { transform: scale(0.93); }
        .bb-fab-mic {
          background: linear-gradient(135deg, #FF725F, #E8594B);
          color: #fff;
          padding: 11px 16px;
          border-radius: 28px;
          font-size: 13.5px;
        }
        .bb-fab-camera {
          background: #FFFDF8;
          color: #261818;
          border: 1.5px solid #F0DFCF;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          justify-content: center;
          font-size: 17px;
        }

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
          .bb-fab-label { display: none; }
          .bb-fab-mic { padding: 11px; border-radius: 50%; }
        }
      `;
      document.head.appendChild(s);
    }
  };

  window.bbVoiceAssistant = VoiceAssistant;

  // Pure parsers exposed for the automated reliability suites (stateless —
  // no DOM, storage or network access).
  VoiceAssistant.parseVoiceTranscript = parseVoiceTranscript;
  VoiceAssistant.extractAmountFromText = extractAmountFromText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VoiceAssistant.init());
  } else {
    VoiceAssistant.init();
  }

})(typeof window !== 'undefined' ? window : this);
