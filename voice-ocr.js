/* ===========================================================
   BaatBanao Voice & OCR Assistant Module (v1.1.0)
   100% Client-Side, Zero-Cost, Fast & Privacy-Safe
   Features:
   1. Voice-to-Khata & WhatsApp (Hindi & Hinglish Natural Speech)
   2. Number Input via Voice or Type with Khata Auto-Match
   3. Camera OCR + Gallery File Upload + Preprocessing (Tesseract.js)
   4. One-tap Sample Bills for instant testing
   5. Instant 3-Tone WhatsApp Generator + One-tap Save to Khata
   =========================================================== */

(function(window){
  'use strict';

  // --- NLP & Extraction Helpers ---

  function cleanSpokenText(t){
    return String(t || '').trim().replace(/[\.,\?!।]/g, ' ');
  }

  function extractAmountFromText(text){
    const clean = cleanSpokenText(text).toLowerCase();

    // 1. Multipliers like "2.5 hazar", "5k", "1 lakh", "2 hazar", "500", etc.
    const multiplierMatch = clean.match(/(\d+(?:\.\d+)?)\s*(lakh|लाख|hazaar|hazar|sau|सौ|हजार|k\b)/i);
    if (multiplierMatch) {
      const val = parseFloat(multiplierMatch[1]);
      const unit = multiplierMatch[2].toLowerCase();
      if (unit === 'lakh' || unit === 'लाख') return Math.round(val * 100000);
      if (unit === 'hazaar' || unit === 'hazar' || unit === 'k' || unit === 'हजार') return Math.round(val * 1000);
      if (unit === 'sau' || unit === 'सौ') return Math.round(val * 100);
    }

    // 2. Direct plain digits like "200", "1200", "₹500"
    const digitMatch = clean.match(/(?:₹|rs\.?|inr)?\s*(\d+[\d,]*)/i);
    if (digitMatch) {
      const parsed = parseInt(digitMatch[1].replace(/,/g, ''), 10);
      if (parsed > 0) return parsed;
    }

    // 3. Spoken number words
    const numWords = {
      'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'panch': 5, 'paanch': 5, 'chhe': 6, 'che': 6,
      'saat': 7, 'aath': 8, 'nau': 9, 'das': 10, 'gyarah': 11, 'barah': 12, 'terah': 13,
      'chaudah': 14, 'pandrah': 15, 'solah': 16, 'satrah': 17, 'atharah': 18, 'unnis': 19, 'bees': 20,
      'dedh': 1.5, 'dhai': 2.5,
      'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'डेढ़': 1.5, 'ढाई': 2.5
    };

    const wordMult = clean.match(/(ek|do|teen|char|panch|paanch|chhe|che|saat|aath|nau|das|dedh|dhai|एक|दो|तीन|चार|पांच|डेढ़|ढाई)\s*(hazaar|hazar|sau|सौ|हजार)/i);
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

    const amount = extractAmountFromText(raw);

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

    let phone = phoneOnlyMatch ? phoneOnlyMatch[1] : '';

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

  // --- Voice & OCR Assistant Controller ---

  const VoiceAssistant = {
    recognition: null,
    isListening: false,
    activeEntry: null,

    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'hi-IN';

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
          this.updateTranscriptUI(`⚠️ Mic Error (${e.error}). Dobara tap karein.`);
          setTimeout(() => this.hideListeningUI(), 2500);
        };

        this.recognition.onend = () => {
          this.isListening = false;
        };
      }
      this.injectUI();
    },

    startVoice() {
      if (typeof bbTrack === 'function') bbTrack('voice_command_start', {});
      if (!this.recognition) {
        alert('Aapke browser me voice recognition support nahi mila. Kripya Chrome ya Edge use karein.');
        return;
      }
      try {
        this.recognition.start();
      } catch (err) {
        try {
          this.recognition.stop();
          setTimeout(() => this.recognition.start(), 300);
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
          const match = window.state.khata.find(k => k.phone && k.phone.includes(parsed.phone));
          if (match) parsed.name = match.name;
        }
        if (parsed.name && !parsed.phone) {
          const match = window.state.khata.find(k => (k.name || '').toLowerCase() === parsed.name.toLowerCase());
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

    handleClearHisaab(name) {
      if (!window.state || !Array.isArray(window.state.khata)) return;
      const target = window.state.khata.find(k => (k.name || '').toLowerCase().includes(name.toLowerCase()));
      if (target) {
        target.status = 'paid';
        target.paidAmount = target.amount;
        target.updatedAt = Date.now();
        if (typeof window.persist === 'function') window.persist();
        if (typeof window.showToast === 'function') {
          window.showToast(`✅ ${target.name} ka hisaab clear kar diya gaya!`);
        }
        if (window.state.route === 'khata' && typeof window.navigate === 'function') {
          window.navigate('khata');
        }
        this.hideListeningUI();
      } else {
        this.updateTranscriptUI(`"${name}" khata me nahi mila. Check karein.`);
      }
    },

    handleQuickReminder(name) {
      if (!window.state || !Array.isArray(window.state.khata)) return;
      const target = window.state.khata.find(k => (k.name || '').toLowerCase().includes(name.toLowerCase()));
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
        this.updateTranscriptUI(`"${name}" khata me nahi mila.`);
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
          <button class="bb-fab-btn bb-fab-camera" onclick="bbVoiceAssistant.openOcrPicker()" title="Scan Bill / Parchi / Photo">
            <span>📷</span>
          </button>
          <button class="bb-fab-btn bb-fab-mic" onclick="bbVoiceAssistant.startVoice()" title="Bolkar Hisaab Likhein">
            <span class="bb-fab-icon">🎙️</span>
            <span class="bb-fab-label">Bolkar Likhein</span>
          </button>
        </div>

        <!-- Hidden Inputs for Camera and File Upload -->
        <input type="file" id="bb-ocr-camera-input" accept="image/*" capture="environment" style="display:none;" onchange="bbVoiceAssistant.handleImageSelected(this)" />
        <input type="file" id="bb-ocr-gallery-input" accept="image/*" style="display:none;" onchange="bbVoiceAssistant.handleImageSelected(this)" />

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
              <div class="bb-samples-box">
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
                <small id="bb-ocr-progress-sub">Tesseract OCR load ho raha hai (Fast Mode)</small>
                <button class="bb-sheet-btn secondary" style="margin-top:18px;" onclick="bbVoiceAssistant.skipOcrToManual()">
                  Skip / Manual Entry Karein ✍️
                </button>
              </div>
            </div>

            <!-- Result Confirmation Stage -->
            <div id="bb-stage-result" style="display:none;">
              <div id="bb-thumb-preview-wrap" style="display:none;margin-bottom:12px;text-align:center;">
                <img id="bb-scanned-thumb" src="" alt="Scanned Bill" style="max-height:90px;border-radius:12px;border:1.5px solid #F0DFCF;box-shadow:0 4px 10px rgba(0,0,0,0.06);" />
              </div>

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
      this.stopVoice();
      const modal = document.getElementById('bb-assistant-modal');
      if (modal) modal.style.display = 'none';
    },

    showResultModal(entry) {
      this.resetModalStages();
      const modal = document.getElementById('bb-assistant-modal');
      const head = document.getElementById('bb-assist-head-title');
      const stageResult = document.getElementById('bb-stage-result');

      head.textContent = entry._isOcr ? '📷 Parchi Scan Result' : '🎙️ Entry Samjhi Gayi!';
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

      this.renderMessageCards(entry);
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
          else alert('Message copied!');
        });
      } else {
        alert('Copied: ' + text);
      }
    },

    saveToKhataAction() {
      this.syncActiveEntry();
      const entry = this.activeEntry;
      if (!entry) return;

      const name = entry.name || 'Customer';
      const amount = entry.amount ? Number(entry.amount) : '';
      const phone = entry.phone ? String(entry.phone).replace(/\D/g, '') : '';

      const newKhataItem = {
        id: 'k-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        phone: phone,
        amount: amount,
        paidAmount: 0,
        type: entry.type === 'dena' ? 'received' : 'gave',
        dueDate: entry.dueDate || '',
        relation: 'General',
        status: 'pending',
        language: 'Hinglish',
        tone: 'Friendly',
        note: entry._isOcr ? 'Added via Camera/File OCR' : 'Added via Voice Command',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (window.state && Array.isArray(window.state.khata)) {
        window.state.khata.unshift(newKhataItem);
        if (typeof window.persist === 'function') window.persist();
        if (typeof window.showToast === 'function') {
          window.showToast(`📒 ${name} (${amount ? '₹' + amount : 'entry'}) Khata me add ho gaya!`);
        }
        if (typeof bbTrack === 'function') bbTrack('voice_khata_save', { has_amount: !!amount });

        this.closeModal();
        if (window.state.route === 'khata' && typeof window.navigate === 'function') {
          window.navigate('khata');
        }
      }
    },

    openInVasooliAction() {
      this.syncActiveEntry();
      const entry = this.activeEntry;
      if (!entry) return;

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
      this.showResultModal({
        name: '',
        amount: '',
        phone: '',
        type: 'lena',
        _isOcr: true
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

      const thumbUrl = URL.createObjectURL(file);
      this.runOcrOnImage(file, thumbUrl);
    },

    // Fast image downscaler and preprocessor for mobile
    preprocessImage(fileOrUrl) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          let maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Enhance contrast
          try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
              const enhanced = gray < 125 ? gray * 0.75 : Math.min(255, gray * 1.15);
              d[i] = d[i+1] = d[i+2] = enhanced;
            }
            ctx.putImageData(imgData, 0, 0);
          } catch(e) {}

          canvas.toBlob((blob) => resolve(blob || fileOrUrl), 'image/jpeg', 0.88);
        };
        img.onerror = () => resolve(fileOrUrl);

        if (typeof fileOrUrl === 'string') {
          img.src = fileOrUrl;
        } else {
          const reader = new FileReader();
          reader.onload = (e) => { img.src = e.target.result; };
          reader.onerror = () => resolve(fileOrUrl);
          reader.readAsDataURL(fileOrUrl);
        }
      });
    },

    async runOcrOnImage(fileOrBlob, thumbUrl) {
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
      progressBar.style.width = '15%';
      progressSub.textContent = 'Resizing & contrast enhancement';

      try {
        // 1. Optimize image resolution for fast processing on mobile
        const optimizedBlob = await this.preprocessImage(fileOrBlob);

        // 2. Load Tesseract.js (v5)
        if (!window.Tesseract && !navigator.onLine) {
          throw new Error('OFFLINE_OCR');
        }
        if (!window.Tesseract) {
          statusText.textContent = 'OCR Engine load ho raha hai...';
          progressBar.style.width = '30%';
          progressSub.textContent = 'Downloading lightweight model...';
          await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
        }

        statusText.textContent = 'Parchi scan ho rahi hai...';
        progressBar.style.width = '50%';
        progressSub.textContent = 'Detecting numbers & customer name...';

        // 3. Fast English & Digits recognition
        const result = await window.Tesseract.recognize(optimizedBlob, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const p = Math.round((m.progress || 0) * 100);
              progressBar.style.width = (50 + Math.round(p * 0.45)) + '%';
              statusText.textContent = `Text Scan: ${p}%`;
            }
          }
        });

        const text = result && result.data ? result.data.text : '';
        console.log('OCR Output Text:\n', text);

        progressBar.style.width = '100%';
        statusText.textContent = 'Scan Complete! ✅';

        // 4. Extract data
        const parsed = this.parseOcrText(text);
        parsed._isOcr = true;
        parsed._thumbSrc = thumbUrl || '';
        this.activeEntry = parsed;

        setTimeout(() => {
          this.showResultModal(parsed);
        }, 400);

      } catch (err) {
        console.error('OCR Error:', err);
        const offline = (err && err.message === 'OFFLINE_OCR') || !navigator.onLine;
        const msg = offline
          ? '📶 Bill scan ke liye pehli baar internet chahiye. Abhi manual entry kar lijiye.'
          : 'OCR scan me dikkat aayi. Kripya manual entry karein.';
        if (typeof window.showToast === 'function') window.showToast(msg); else alert(msg);
        this.skipOcrToManual();
      }
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
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let phone = '';
      let amount = null;
      let name = '';
      let date_str = '';

      // 1. Mobile Number (10-digit)
      const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
      if (phoneMatch) phone = phoneMatch[1];

      // 2. Date
      const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
      if (dateMatch) date_str = dateMatch[1];

      // 3. Amount Extraction
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (/(total|grand|net|amount|bal|balance|due|₹|rs\.?|kul|baaki)/i.test(line)) {
          const m = line.match(/(?:₹|rs\.?)?\s*(\d+[\d,]*)/ig);
          if (m) {
            for (let j = m.length - 1; j >= 0; j--) {
              const rawNum = m[j].replace(/[^\d]/g, '');
              const val = parseInt(rawNum, 10);
              if (val > 10 && val !== 2026 && (!phone || rawNum !== phone)) {
                amount = val;
                break;
              }
            }
          }
        }
        if (amount) break;
      }

      // Fallback amount: find largest reasonable number
      if (!amount) {
        const allNums = text.match(/\b\d{2,6}\b/g);
        if (allNums) {
          const valid = allNums.map(n => parseInt(n, 10)).filter(n => n > 20 && n !== 2026 && n !== parseInt(phone, 10));
          if (valid.length > 0) amount = Math.max(...valid);
        }
      }

      // 4. Customer Name Match
      for (const line of lines) {
        const nm = line.match(/(?:customer\s*name|tenant\s*name|client\s*name|billed\s*to(?:\s*\([^\)]*\))?|customer|client|naam|name|shri|m\/s|tenant|owner)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{2,30})/i);
        if (nm) {
          name = nm[1].replace(/\b(date|mob|mobile|phone|ph|dt|inv|bill)\b.*$/i, '').trim();
          break;
        }
      }

      if (!name) {
        for (const line of lines) {
          if (/^[A-Za-z\s]{3,20}$/.test(line) && !/invoice|cash|memo|bill|parchi|tax|receipt|store|market/i.test(line)) {
            name = line.trim();
            break;
          }
        }
      }

      return {
        name: name || 'Customer',
        amount: amount || '',
        phone: phone || '',
        type: 'lena',
        dueDate: date_str,
        dueText: date_str ? `Date: ${date_str}` : 'Parchi Hisaab',
        raw: text.slice(0, 100)
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VoiceAssistant.init());
  } else {
    VoiceAssistant.init();
  }

})(typeof window !== 'undefined' ? window : this);
