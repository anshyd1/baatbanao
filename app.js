/* ===========================================================
   BaatBanao — app.js v2.2 FIXED
   index.html mein topbar + bottom-nav already hai
   Views sirf #content ke andar content daalenge
   Depends on: storage.js + messages.js
   =========================================================== */

/* ===========================================================
   TOAST
   =========================================================== */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ===========================================================
   ROUTING
   =========================================================== */
function navigate(route, params = {}) {
  state.route = route;
  state.routeParams = params;
  window.location.hash = route;
  renderApp();
  const c = document.getElementById('content');
  if (c && c.scrollTo) c.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  const r = window.location.hash.replace('#', '') || 'home';
  state.route = r;
  renderApp();
});

/* ===========================================================
   ICONS
   =========================================================== */
const ICONS = {
  back:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  copy:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 8V6C16 4.9 15.1 4 14 4H6C4.9 4 4 4.9 4 6V14C4 15.1 4.9 16 6 16H8" stroke="currentColor" stroke-width="2"/></svg>`,
  whatsapp: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.13-1.33A9.93 9.93 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2c-1.58 0-3.06-.47-4.3-1.26l-.3-.18-3.06.8.82-2.96-.2-.32A8.19 8.19 0 013.6 11.85C3.6 7.35 7.35 3.6 12.05 3.6c4.5 0 8.25 3.75 8.25 8.25 0 4.5-3.8 8.35-8.3 8.35zm4.55-6c-.25-.12-1.45-.7-1.68-.78-.22-.08-.39-.12-.55.13-.16.25-.63.78-.78.95-.14.16-.3.18-.54.06-.25-.12-1.02-.37-1.96-1.21-.72-.65-1.22-1.46-1.36-1.7-.14-.25-.01-.37.11-.49.11-.11.25-.29.37-.43.12-.13.17-.23.25-.4.08-.16.04-.31-.02-.43-.06-.12-.56-1.32-.77-1.81-.2-.48-.41-.41-.56-.42h-.48c-.17 0-.44.06-.67.31-.23.25-.87.84-.87 2.04s.89 2.37 1.01 2.53c.13.17 1.76 2.54 4.27 3.56 1.66.69 2.28.75 3.08.63.49-.07 1.51-.6 1.72-1.21.21-.61.21-1.13.15-1.24-.06-.11-.23-.18-.48-.3z"/></svg>`,
  save:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 4C5 3.45 5.45 3 6 3h10.17c.27 0 .52.11.71.29l2.83 2.83c.19.19.29.44.29.71V20c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1V4z" stroke="currentColor" stroke-width="2"/><path d="M8 3v5h7V3M8 21v-7h8v7" stroke="currentColor" stroke-width="2"/></svg>`,
  refresh:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bell:     `<span style="font-size:14px">🔔</span>`,
  crown:    `<span style="font-size:14px">👑</span>`,
  check:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  mic:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="2"/><path d="M19 11V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 19V22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

/* ===========================================================
   HOME VIEW — sirf content, koi topbar/nav nahi
   =========================================================== */
function viewHome() {
  const latest = state.khata.find(k => k.status === 'pending');
  return `
    <div class="hero-greeting">
      <h1>Namaste! 🙏<br>Aaj kya likhna hai?</h1>
      <img src="assets/mascot-coin.webp" alt="BaatBanao mascot" class="mascot-img" />
    </div>

    <button class="hero-card" onclick="navigate('vasooli')">
      <img src="assets/vasooli-hero-banner.webp" alt=""
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:22px;opacity:.18;" />
      <h2>Vasooli Mode 💸</h2>
      <p>Paisa bhi wapas, rishta bhi safe 😄</p>
      <span style="margin-top:12px;display:inline-block;font-size:13px;font-weight:800;color:rgba(255,255,255,.9)">Shuru karo →</span>
    </button>

    <div class="secondary-row">
      <button class="sec-card" onclick="navigate('vasooli')">
        <h3>Business Reply 💼</h3>
        <p>Draft professional polite replies</p>
      </button>
      <button class="sec-card" onclick="navigate('vasooli')">
        <h3>Masti Message 😄</h3>
        <p>Fun chat &amp; sticker ideas</p>
      </button>
    </div>

    <div class="input-pill" onclick="navigate('vasooli')">
      <span>Bolo ya type karo...</span>${ICONS.mic}
    </div>

    <div class="lang-chips">
      ${['Hinglish','Hindi','Bhojpuri','English'].map(l => `
        <button class="lang-chip ${state.settings.defaultLanguage===l?'active':''}"
          onclick="setDefaultLang('${l}')">${l}</button>`).join('')}
    </div>

    <div class="khata-strip" onclick="navigate('khata')">
      <span class="khata-strip-label">Khata ${ICONS.bell}</span>
      <span class="khata-strip-text">
        ${latest
          ? `📒 <strong>${escapeHtml(latest.name)}</strong> — ${fmtMoney(latest.amount)} pending — Remind karo`
          : `Koi pending nahi hai. Sab clear! ✅`}
      </span>
    </div>`;
}

function setDefaultLang(l) { settingSet('defaultLanguage', l); renderApp(); }

/* ===========================================================
   VASOOLI VIEW
   =========================================================== */
function viewVasooli() {
  const s = state.vasooliForm || {
    name:'', phone:'', amount:'', relation:'Dost',
    language: state.settings.defaultLanguage || 'Hinglish',
    tone: state.settings.defaultTone || 'Friendly',
    note:''
  };
  if (s.phone === undefined) s.phone = '';
  state.vasooliForm = s;

  const relations = ['Dost','Customer','Client','Student/Parent','Tenant','Shop Khata','Relative','General'];
  const languages = ['Hinglish','Hindi','Bhojpuri','English'];
  const tones = [
    { key:'Friendly', label:'😊 Friendly' },
    { key:'Polite',   label:'🙏 Polite'   },
    { key:'Funny',    label:'😂 Funny'    },
    { key:'Strong',   label:'💪 Strong'   },
  ];

  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('home')">${ICONS.back}</button>
      <span class="page-title">Vasooli Mode 💸</span>
      <div style="width:38px"></div>
    </div>

    <p class="page-sub">Naam, amount aur tone select karo — har baar naya message!</p>

    <div class="form-group">
      <label class="form-label">Naam</label>
      <input class="form-input" type="text" placeholder="Ramesh bhai"
        value="${escapeHtml(s.name)}" oninput="updateVForm('name',this.value)" />
    </div>
    <div class="form-group">
      <label class="form-label">WhatsApp Number (optional)</label>
      <input class="form-input" type="tel" placeholder="9XXXXXXXXX"
        value="${escapeHtml(s.phone)}" oninput="updateVForm('phone',this.value)" />
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹)</label>
      <input class="form-input" type="number" placeholder="2500"
        value="${escapeHtml(s.amount)}" oninput="updateVForm('amount',this.value)" />
    </div>
    <div class="form-group">
      <label class="form-label">Relation</label>
      <div class="chip-row">
        ${relations.map(r => `
          <button class="chip ${s.relation===r?'active':''}"
            onclick="updateVForm('relation','${r}');renderApp()">${r}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Language</label>
      <div class="chip-row">
        ${languages.map(l => `
          <button class="chip ${s.language===l?'active':''}"
            onclick="updateVForm('language','${l}');renderApp()">${l}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tone</label>
      <div class="chip-row">
        ${tones.map(t => `
          <button class="chip ${s.tone===t.key?'active':''}"
            onclick="updateVForm('tone','${t.key}');renderApp()">${t.label}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Note (optional)</label>
      <input class="form-input" type="text" placeholder="2 mahine se pending hai, aaj chahiye"
        value="${escapeHtml(s.note)}" oninput="updateVForm('note',this.value)" />
    </div>

    <button class="btn-primary" onclick="handleGenerate()">Message Banao ✨</button>
    <p class="safety-note">BaatBanao sirf respectful reminders banata hai. Bhejne se pehle check/edit kar lein.</p>

    <div id="vasooli-output"></div>`;
}

function updateVForm(field, value) {
  if (!state.vasooliForm) state.vasooliForm = {};
  state.vasooliForm[field] = value;
}

/* ===========================================================
   GENERATE + OUTPUT
   =========================================================== */
function handleGenerate() {
  const s = state.vasooliForm;
  if (!s || !s.name || !s.name.trim()) { showToast('Naam daalna zaroori hai'); return; }
  if (!s.amount || Number(s.amount) <= 0) { showToast('Sahi amount daalein'); return; }

  const check = bbCanGenerate();
  if (!check.allowed) {
    showToast(`Aaj ke ${BB_FREE_DAILY_LIMIT} free messages khatam! Pro lo 👑`);
    setTimeout(() => navigate('pro'), 900);
    return;
  }

  const out = document.getElementById('vasooli-output');
  if (!out) return;

  out.innerHTML = `
    <div style="text-align:center;padding:32px 20px;">
      <img src="assets/mascot-thinking.webp" alt="" width="80" />
      <p style="margin-top:12px;font-weight:700;color:var(--text-secondary);font-size:13px;">
        Dosti bachate hue hisaab bana rahe hain...
      </p>
    </div>`;

  setTimeout(() => {
    const combined = (s.name || '') + ' ' + (s.note || '');
    let messages, unsafeHtml = '';

    if (isUnsafe(combined)) {
      unsafeHtml = `<div class="unsafe-notice">⚠️ Gaali ke bina bhi strong message ban sakta hai:</div>`;
      messages = [{ label:'💪 Strong but Respectful', text: safeAlternative(s.name, s.amount) }];
    } else {
      messages = generateMessages(s);
    }

    messages.forEach(m => historyAdd({
      id: uid(), message: m.text, name: s.name,
      amount: Number(s.amount) || 0, language: s.language,
      tone: m.label, action: 'generated', copied: false, shared: false,
      createdAt: Date.now(),
    }));

    bbRecordGeneration();

    const { remaining } = bbCanGenerate();
    const limitNote = (!isBBPro() && remaining <= 2)
      ? `<div class="limit-notice">Aaj ${remaining} free message${remaining===1?'':'s'} bache.
           <a onclick="navigate('pro')" style="cursor:pointer;font-weight:800;color:var(--coral)">Pro lo 👑</a></div>`
      : '';

    out.innerHTML = `
      ${unsafeHtml}${limitNote}
      <div class="output-header">Ready Messages ✨</div>
      <div class="output-regen-row">
        <button class="btn-regen" onclick="handleGenerate()">
          ${ICONS.refresh} Naye dikhao
        </button>
        <span style="font-size:11px;color:var(--text-muted)">Pasand nahi? Dobara banao!</span>
      </div>
      ${messages.map((m, i) => outputCard(m, i)).join('')}`;
  }, 600);
}

function outputCard(m, idx) {
  const taId = 'out-' + idx;
  return `
  <div class="output-card">
    <div class="output-label">${m.label}</div>
    <textarea id="${taId}" class="output-textarea">${escapeHtml(m.text)}</textarea>
    <div class="output-actions">
      <button class="btn-action" onclick="copyOutput('${taId}')">${ICONS.copy} Copy</button>
      <button class="btn-action btn-wa" onclick="waOutput('${taId}')">${ICONS.whatsapp} WhatsApp</button>
      <button class="btn-action" onclick="saveToKhata('${taId}')">${ICONS.save} Khata</button>
    </div>
  </div>`;
}

function copyOutput(taId) {
  const ta = document.getElementById(taId);
  if (!ta) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value)
      .then(() => showToast('Copied! ✅'))
      .catch(() => { ta.select(); document.execCommand('copy'); showToast('Copied! ✅'); });
  } else { ta.select(); document.execCommand('copy'); showToast('Copied! ✅'); }
}

function waOutput(taId) {
  const ta = document.getElementById(taId);
  if (!ta) return;
  const text = encodeURIComponent(ta.value);
  const s = state.vasooliForm || {};
  let phone = s.phone ? String(s.phone).replace(/[^0-9]/g, '') : '';
  if (phone.length === 10) phone = '91' + phone;
  window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
}

function saveToKhata(taId) {
  const ta = document.getElementById(taId);
  const s  = state.vasooliForm || {};
  khataAdd({
    id: uid(), name: s.name || 'Unknown', phone: s.phone || '',
    amount: Number(s.amount) || 0, relation: s.relation || 'General',
    status: 'pending', dueDate: null, lastReminderAt: Date.now(),
    language: s.language, tone: s.tone, note: s.note || '',
    message: ta ? ta.value : '',
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  showToast('Khata mein save ho gaya 📒');
}

/* ===========================================================
   KHATA VIEW
   =========================================================== */
function viewKhata() {
  const pending = state.khata.filter(k => k.status === 'pending');
  const total   = pending.reduce((a, b) => a + Number(b.amount || 0), 0);
  const f       = state.khataFilter || 'all';
  const list    = state.khata.filter(k => f === 'all' ? true : k.status === f);

  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('home')">${ICONS.back}</button>
      <span class="page-title">Udhaar Khata</span>
      <div style="width:38px"></div>
    </div>

    <div class="khata-summary">
      <div class="khata-total">${fmtMoney(total)}</div>
      <div class="khata-count">${pending.length} pending payment${pending.length===1?'':'s'}</div>
      <button class="btn-primary" onclick="navigate('vasooli')" style="margin-top:12px;">
        Reminder Message Banao 🔔
      </button>
    </div>

    <div class="chip-row" style="margin-bottom:8px;">
      ${['all','pending','paid'].map(fv => `
        <button class="chip ${f===fv?'active':''}" onclick="setKhataFilter('${fv}')">
          ${fv==='all'?'All':fv==='pending'?'Pending':'Paid'}
        </button>`).join('')}
    </div>

    ${list.length === 0
      ? `<div style="text-align:center;padding:40px 20px;">
           <img src="assets/mascot-sleeping.webp" alt="" width="100" />
           <p style="margin-top:14px;font-weight:700;color:var(--text-secondary)">
             <strong>Sab clear!</strong> ✨<br>Coin so raha hai.
           </p>
         </div>`
      : list.map(k => khataCard(k)).join('')}`;
}

function setKhataFilter(f) { state.khataFilter = f; renderApp(); }

function khataCard(k) {
  return `
  <div class="khata-card">
    <div class="khata-card-top">
      <span class="khata-name">${escapeHtml(k.name)}</span>
      <span class="khata-amount">${fmtMoney(k.amount)}</span>
    </div>
    <div class="khata-card-sub">
      ${escapeHtml(k.relation||'General')} ·
      ${k.status==='paid' ? 'Paid '+timeAgo(k.updatedAt) : (k.note ? escapeHtml(k.note) : 'Pending')}
    </div>
    <div class="khata-status-row">
      <span class="status-badge ${k.status==='paid'?'paid':'pending'}">
        ${k.status==='paid'?'Paid ✅':'Pending'}
      </span>
      <div class="khata-actions">
        ${k.status==='pending'
          ? `<button class="btn-action" onclick="remindKhata('${k.id}')">🔔 Remind</button>
             <button class="btn-action btn-paid" onclick="markPaid('${k.id}')">${ICONS.check} Paid</button>`
          : ''}
        <button class="btn-action btn-danger" onclick="deleteKhata('${k.id}')">${ICONS.trash}</button>
      </div>
    </div>
  </div>`;
}

function remindKhata(id) {
  const k = state.khata.find(x => x.id === id);
  if (!k) return;
  const text = k.message || (generateMessages(k)[0] || {}).text || '';
  let phone = k.phone ? String(k.phone).replace(/[^0-9]/g, '') : '';
  if (phone.length === 10) phone = '91' + phone;
  khataUpdate(id, { lastReminderAt: Date.now() });
  window.open(phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  showToast('WhatsApp khul raha hai...');
}

function markPaid(id) {
  const k = state.khata.find(x => x.id === id);
  if (!k) return;
  khataUpdate(id, { status:'paid' });
  showPaidCelebration(k.name, k.amount);
  renderApp();
}

function showPaidCelebration(name, amount) {
  const ex = document.getElementById('bb-celebrate');
  if (ex) ex.remove();
  const el = document.createElement('div');
  el.id = 'bb-celebrate'; el.className = 'bb-celebrate-overlay';
  el.innerHTML = `
    <div class="bb-celebrate-box">
      <img src="assets/mascot-paid.webp" alt="" width="100" />
      <h2>Paisa aa gaya! 🎉</h2>
      <p><strong>${escapeHtml(name)}</strong> ne <strong>${fmtMoney(amount)}</strong> clear kiya</p>
      <p>Dosti safe, hisaab clear ✨</p>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

function deleteKhata(id) { khataDelete(id); renderApp(); showToast('Entry delete ho gayi'); }

/* ===========================================================
   HISTORY VIEW
   =========================================================== */
function viewHistory() {
  const list = state.history;
  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('home')">${ICONS.back}</button>
      <span class="page-title">History</span>
      <div style="width:38px"></div>
    </div>

    ${list.length === 0
      ? `<div style="text-align:center;padding:40px 20px;">
           <img src="assets/mascot-thinking.webp" alt="" width="100" />
           <p style="margin-top:14px;font-weight:700;color:var(--text-secondary)">
             <strong>Abhi tak koi message nahi banaya.</strong><br>Vasooli Mode kholo aur shuru karo!
           </p>
         </div>`
      : list.map(h => historyCard(h)).join('')}

    ${list.length > 0
      ? `<button class="btn-danger-outline" onclick="clearHistory()">
           ${ICONS.trash} Clear All History
         </button>` : ''}`;
}

function historyCard(h) {
  const taId = 'hist-' + h.id;
  return `
  <div class="output-card">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span class="output-label">${escapeHtml(h.tone)}</span>
      <span style="font-size:11px;color:var(--text-muted)">${timeAgo(h.createdAt)}</span>
    </div>
    <textarea id="${taId}" class="output-textarea" readonly>${escapeHtml(h.message)}</textarea>
    <div class="output-actions">
      <button class="btn-action" onclick="copyOutput('${taId}')">${ICONS.copy} Copy</button>
      <button class="btn-action btn-wa" onclick="waOutput('${taId}')">${ICONS.whatsapp} WhatsApp</button>
      <button class="btn-action btn-danger" onclick="deleteHistoryItem('${h.id}')">${ICONS.trash}</button>
    </div>
  </div>`;
}

function deleteHistoryItem(id) { historyDelete(id); renderApp(); }
function clearHistory() {
  if (!confirm('Poori history delete karni hai?')) return;
  historyClear(); renderApp();
}

/* ===========================================================
   PROFILE VIEW
   =========================================================== */
function viewProfile() {
  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('home')">${ICONS.back}</button>
      <span class="page-title">Profile</span>
      <div style="width:38px"></div>
    </div>

    <div class="profile-card">
      <h2>Guest User 🙌</h2>
      <p>Login abhi optional hai — sab kuch is device par save hai.</p>
    </div>
    <div class="stat-row">
      <div class="stat-item">
        <div class="stat-val">${state.khata.length}</div>
        <div class="stat-lbl">📒 Khata Entries</div>
      </div>
      <div class="stat-item">
        <div class="stat-val">${state.history.length}</div>
        <div class="stat-lbl">🕓 Messages</div>
      </div>
    </div>
    <button class="btn-secondary" onclick="navigate('settings')">Settings ⚙️</button>
    ${isBBPro()
      ? `<div class="pro-active-badge">👑 BaatBanao Pro — Active ✅</div>`
      : `<button class="btn-primary" onclick="navigate('pro')">👑 Upgrade to BaatBanao Pro</button>`}`;
}

/* ===========================================================
   SETTINGS VIEW
   =========================================================== */
function viewSettings() {
  const s = state.settings;
  const tones = [
    { key:'Friendly', label:'😊 Friendly' },
    { key:'Polite',   label:'🙏 Polite'   },
    { key:'Funny',    label:'😂 Funny'    },
    { key:'Strong',   label:'💪 Strong'   },
  ];
  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('profile')">${ICONS.back}</button>
      <span class="page-title">Settings</span>
      <div style="width:38px"></div>
    </div>

    <div class="form-group">
      <label class="form-label">Default language</label>
      <div class="chip-row">
        ${['Hinglish','Hindi','Bhojpuri','English'].map(l => `
          <button class="chip ${s.defaultLanguage===l?'active':''}"
            onclick="settingSet('defaultLanguage','${l}');renderApp()">${l}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Default tone</label>
      <div class="chip-row">
        ${tones.map(t => `
          <button class="chip ${s.defaultTone===t.key?'active':''}"
            onclick="settingSet('defaultTone','${t.key}');renderApp()">${t.label}</button>`).join('')}
      </div>
    </div>
    <div class="settings-toggle-row">
      <span>Messages mein emoji use karo</span>
      <button class="toggle-btn ${s.emojiEnabled?'on':''}"
        onclick="settingToggle('emojiEnabled');renderApp()">${s.emojiEnabled?'ON':'OFF'}</button>
    </div>
    <button class="btn-secondary" onclick="navigate('pro')">
      👑 BaatBanao Pro ${isBBPro()?'Active ✅':'Upgrade ›'}
    </button>
    <button class="btn-danger-outline" onclick="clearAllData()">
      ${ICONS.trash} Clear all app data
    </button>`;
}

function clearAllData() {
  if (!confirm('Sabhi data delete karna hai? Yeh wapas nahi hoga.')) return;
  localStorage.removeItem(STORE_KEYS.khata);
  localStorage.removeItem(STORE_KEYS.history);
  localStorage.removeItem(STORE_KEYS.settings);
  location.reload();
}

/* ===========================================================
   PRO VIEW
   =========================================================== */
function viewPro() {
  return `
    <div class="page-topbar">
      <button class="icon-btn" onclick="navigate('home')">${ICONS.back}</button>
      <span class="page-title">BaatBanao Pro 👑</span>
      <div style="width:38px"></div>
    </div>

    <div style="text-align:center;padding:8px 0 16px;">
      <h2 style="font-size:22px;font-weight:900;">Vasooli bhi smart, app bhi Pro 😄</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">Watermark hatao, unlimited messages banao.</p>
    </div>

    <div class="pro-plan-card">
      <div class="pro-plan-title">BaatBanao Pro</div>
      <div class="pro-plan-price">₹149 <span>lifetime</span></div>
      <ul class="pro-features">
        <li>✅ Unlimited generation (free = ${BB_FREE_DAILY_LIMIT}/din)</li>
        <li>✅ No watermark on cards</li>
        <li>✅ Sab tone/language unlock</li>
        <li>✅ Priority features pehle</li>
      </ul>
      <button class="btn-primary" onclick="bbStartPurchase('pro')">₹149 mein Unlock Karo</button>
    </div>

    <div class="pro-plan-card" style="margin-top:12px;">
      <div class="pro-plan-title">Business Pack</div>
      <div class="pro-plan-price">₹499 <span>lifetime</span></div>
      <ul class="pro-features">
        <li>✅ Sab kuch Pro jaisa +</li>
        <li>✅ Multiple business profiles</li>
        <li>✅ Business template packs</li>
      </ul>
      <button class="btn-primary" onclick="bbStartPurchase('business')">₹499 mein Unlock Karo</button>
    </div>

    <div id="bb-pay-step" style="display:none;margin-top:16px;">
      <div class="pro-step">
        <b>Step 1</b> — UPI se Payment Karo<br>
        <button class="btn-primary" id="bb-upi-btn" style="margin-top:8px;">📲 UPI se Pay Karo</button>
      </div>
      <div class="pro-step">
        <b>Step 2</b> — Screenshot Bhejo<br>
        <button class="btn-secondary" id="bb-wa-btn" style="margin-top:8px;">💬 WhatsApp Screenshot</button>
      </div>
      <div class="pro-step">
        <b>Step 3</b> — Code Daalo<br>
        <input id="bb-phone-input" class="form-input" type="tel" placeholder="10-digit phone number" style="margin-top:8px;" />
        <input id="bb-code-input" class="form-input" type="text" placeholder="6-character code" style="margin-top:8px;text-transform:uppercase;" />
        <button class="btn-primary" onclick="bbRedeemCode()" style="margin-top:8px;">✅ Unlock Karo</button>
        <div id="bb-redeem-msg" style="margin-top:8px;font-size:13px;font-weight:700;"></div>
      </div>
    </div>

    <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:16px;">
      🙏 BaatBanao ek writing assistant hai. Payment 100% manual-verified hai.
    </p>`;
}

let bbSelectedPlan = 'pro';
function bbStartPurchase(plan) {
  bbSelectedPlan = plan;
  const step = document.getElementById('bb-pay-step');
  step.style.display = 'block';
  step.scrollIntoView({ behavior:'smooth' });
  const amt = plan === 'business' ? 499 : 149;
  const note = encodeURIComponent(`BaatBanao ${plan==='business'?'Business Pack':'Pro'}`);
  document.getElementById('bb-upi-btn').onclick = () => {
    window.location.href = `upi://pay?pa=${BB_UPI_ID}&pn=BaatBanao&am=${amt}&cu=INR&tn=${note}`;
  };
  document.getElementById('bb-wa-btn').onclick = () => {
    const msg = encodeURIComponent(`Namaste! Maine BaatBanao ${plan==='business'?'Business Pack':'Pro'} (₹${amt}) ka payment kiya hai. Screenshot attach kar raha/rahi hoon. Mera phone number: `);
    window.open(`https://wa.me/${BB_ADMIN_WA}?text=${msg}`, '_blank');
  };
}

function bbRedeemCode() {
  const phone = document.getElementById('bb-phone-input').value.replace(/\D/g,'');
  const code  = document.getElementById('bb-code-input').value.trim().toUpperCase();
  const msgEl = document.getElementById('bb-redeem-msg');
  if (phone.length !== 10) { msgEl.textContent = '⚠️ Sahi 10-digit number daalo.'; msgEl.style.color='#C0392B'; return; }
  if (bbGenerateRedeemCode(phone, bbSelectedPlan) === code) {
    localStorage.setItem(BB_PRO_KEY,'1');
    localStorage.setItem(BB_PRO_PLAN_KEY, bbSelectedPlan);
    msgEl.textContent = '🎉 BaatBanao Pro Unlock ho gaya! Dhanyavaad.';
    msgEl.style.color = '#247C32';
    setTimeout(() => navigate('profile'), 1400);
  } else {
    msgEl.textContent = '❌ Code galat hai.';
    msgEl.style.color = '#C0392B';
  }
}

/* ===========================================================
   MENU DRAWER
   =========================================================== */
function openMenu()  {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('drawer').classList.add('show');
}
function closeMenu() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
}

/* ===========================================================
   RENDER ENGINE — sirf #content update karta hai
   =========================================================== */
const ROUTES = {
  home:     viewHome,
  vasooli:  viewVasooli,
  khata:    viewKhata,
  history:  viewHistory,
  profile:  viewProfile,
  settings: viewSettings,
  pro:      viewPro,
  chat:     () => '<div id="chatMount"></div>',
  connect:  () => '<div id="chatMount"></div>',
};

function renderApp() {
  const route = state.route || 'home';

  // Chat — Firebase handles it
  if (route === 'chat' || route === 'connect') {
    if (typeof window.BB_loadFirebase === 'function') window.BB_loadFirebase();
    document.getElementById('content').innerHTML = '';
    if (typeof window.renderChatView === 'function') {
      window.renderChatView(route === 'connect' ? 'connect' : 'list');
    } else {
      document.getElementById('content').innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <img src="assets/mascot-thinking.webp" alt="" width="100"/>
          <p style="margin-top:14px;font-weight:700;color:#75615C;">Chat connect ho raha hai...</p>
        </div>`;
    }
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.route === 'chat'));
    return;
  }

  // Normal route — sirf content inject karo
  const fn = ROUTES[route] || viewHome;
  document.getElementById('content').innerHTML = fn();

  // Bottom nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    const navRoutes = ['home','khata','history','profile','chat'];
    el.classList.toggle('active',
      el.dataset.route === (navRoutes.includes(route) ? route : ''));
  });
}

/* ===========================================================
   INIT
   =========================================================== */
function initApp() {
  const r = window.location.hash.replace('#','') || 'home';
  state.route = r;
  renderApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
