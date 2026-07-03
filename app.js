/* ===========================================================
   BaatBanao — App Logic (SPA, localStorage, no backend needed)
   =========================================================== */

const STORE_KEYS = { khata:'bb_khata', history:'bb_history', settings:'bb_settings' };

function loadStore(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
function saveStore(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

let state = {
  khata: loadStore(STORE_KEYS.khata, [
    { id: uid(), name:'Ramesh bhai', phone:'', amount:2500, relation:'Dost', status:'pending',
      language:'Hinglish', tone:'Friendly', note:'2 mahine se pending',
      createdAt: Date.now(), updatedAt: Date.now() }
  ]),
  history: loadStore(STORE_KEYS.history, []),
  settings: loadStore(STORE_KEYS.settings, {
    defaultLanguage:'Hinglish', defaultTone:'Friendly', emojiEnabled:true, watermarkEnabled:true
  }),
  route: 'home'
};

function persist(){
  saveStore(STORE_KEYS.khata, state.khata);
  saveStore(STORE_KEYS.history, state.history);
  saveStore(STORE_KEYS.settings, state.settings);
}

function uid(){ return 'id-' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }

function fmtMoney(n){ return '₹' + Number(n).toLocaleString('en-IN'); }

function timeAgo(ts){
  const diff = Date.now() - ts;
  const min = Math.floor(diff/60000);
  if(min < 1) return 'abhi abhi';
  if(min < 60) return min + ' min pehle';
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + ' ghante pehle';
  const day = Math.floor(hr/24);
  return day + ' din pehle';
}

/* ===========================================================
   SAFETY FILTER
   =========================================================== */
const UNSAFE_WORDS = ['gaali','madarchod','behenchod','chutiya','bhosdi','randi','saale','kutte','harami',
  'dhamki','maar','jail bhej','police bulaunga','badnaam','beizzati','threat','kill','laat','thappad'];

function isUnsafe(text){
  if(!text) return false;
  const t = text.toLowerCase();
  return UNSAFE_WORDS.some(w => t.includes(w));
}

/* ===========================================================
   MESSAGE GENERATION ENGINE (rule-based, per plan spec)
   =========================================================== */
function generateMessages({name, amount, relation, language, tone, note}){
  const amt = fmtMoney(amount);
  const n = name && name.trim() ? name.trim() : 'Bhai';
  const noteLine = note && note.trim() ? note.trim() : '';

  const emojiOn = state.settings.emojiEnabled;
  const e = (s) => emojiOn ? s : '';

  const templates = {
    Hinglish: {
      Friendly: `${n}, ${amt} abhi pending hai. Aaj bhej doge toh bahut help ho jayegi. Dosti apni jagah, hisaab apni jagah ${e('😄')}${noteLine? ' ('+noteLine+')':''}`,
      Polite: `${n}, aapka ${amt} payment pending hai. Kripya jab time mile aaj bhej dein, bahut sahayata ho jayegi ${e('🙏')}${noteLine? '. '+noteLine:''}`,
      Strong: `${n}, ${amt} ka payment kaafi din se pending hai. Kripya aaj tak clear kar dein. Hisaab timely clear rehna zaroori hai.${noteLine? ' ('+noteLine+')':''}`
    },
    Hindi: {
      Friendly: `${n}, ${amt} abhi baaki hai. Aaj bhej doge toh bahut acha lagega ${e('😄')}${noteLine? '. '+noteLine:''}`,
      Polite: `${n}, aapka ${amt} abhi pending hai. Kripya aaj bhej dein, bahut sahayata ho jayegi.${noteLine? ' '+noteLine:''}`,
      Strong: `${n}, aapka ${amt} kaafi samay se pending hai. Kripya aaj hi bhugtan kar dein.${noteLine? ' ('+noteLine+')':''}`
    },
    Bhojpuri: {
      Friendly: `${n} bhaiya, ${amt} baaki ba. Aaj bhej da, bahut meharbani hoi. Dosti alag ba, hisaab alag ba ${e('😄')}`,
      Polite: `${n} bhaiya, ${amt} ke rakam abhi baaki ba. Aaj bhej dijiye, bahut meharbani hoi ${e('🙏')}`,
      Strong: `${n} bhaiya, ${amt} bahut din se baaki ba. Aaj tak clear kar dijiye, jaruri ba.`
    },
    English: {
      Friendly: `Hey ${n}, ${amt} is still pending. It'd really help if you could send it today. All good between us, just clearing the account ${e('😄')}`,
      Polite: `Hi ${n}, this is a gentle reminder that ${amt} is still pending. Please send it today if possible. Thank you ${e('🙏')}`,
      Strong: `Hi ${n}, the payment of ${amt} has been pending for a while now. Kindly clear it today. Timely settlement is important.`
    }
  };

  const langSet = templates[language] || templates['Hinglish'];
  return [
    { label:'Friendly', text: langSet.Friendly },
    { label:'Polite', text: langSet.Polite },
    { label:'Strong but Respectful', text: langSet.Strong }
  ];
}

function safeAlternative(name, amount){
  return `${name || 'Bhai'}, payment kaafi din se pending hai (${fmtMoney(amount||0)}). Kripya aaj clear kar do. Dosti apni jagah, hisaab apni jagah 🙏`;
}

/* ===========================================================
   TOAST
   =========================================================== */
let toastTimer;
function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 2200);
}

/* ===========================================================
   ROUTING
   =========================================================== */
function navigate(route, params={}){
  state.route = route;
  state.routeParams = params;
  window.location.hash = route;
  renderApp();
  document.getElementById('content')?.scrollTo?.(0,0);
}

window.addEventListener('hashchange', ()=>{
  const r = window.location.hash.replace('#','') || 'home';
  state.route = r;
  renderApp();
});

/* ===========================================================
   ICONS (inline svg strings)
   =========================================================== */
const ICONS = {
  menu:`<svg width="22" height="16" viewBox="0 0 22 16" fill="none"><path d="M1 1H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M1 8H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M1 15H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  mic:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="2"/><path d="M19 11V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 19V22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  home:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 11L12 3L21 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9.5V20C5 20.55 5.45 21 6 21H9.5C10.05 21 10.5 20.55 10.5 20V15C10.5 14.45 10.95 14 11.5 14H12.5C13.05 14 13.5 14.45 13.5 15V20C13.5 20.55 13.95 21 14.5 21H18C18.55 21 19 20.55 19 20V9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  khata:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 8H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 16H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  history:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7V12L15.5 14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  profile:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20C4 16.13 7.58 13 12 13C16.42 13 20 16.13 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  back:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  copy:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 8V6C16 4.9 15.1 4 14 4H6C4.9 4 4 4.9 4 6V14C4 15.1 4.9 16 6 16H8" stroke="currentColor" stroke-width="2"/></svg>`,
  whatsapp:`<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.37 17.07L2 22L7.13 20.67C8.56 21.45 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20.2C10.42 20.2 8.94 19.73 7.7 18.94L7.4 18.76L4.34 19.56L5.16 16.6L4.96 16.28C4.09 14.96 3.6 13.44 3.6 11.85C3.6 7.35 7.35 3.6 12.05 3.6C16.55 3.6 20.3 7.35 20.3 11.85C20.3 16.35 16.5 20.2 12 20.2ZM16.55 14.2C16.3 14.08 15.1 13.5 14.87 13.42C14.65 13.34 14.48 13.3 14.32 13.55C14.15 13.8 13.68 14.35 13.53 14.52C13.4 14.68 13.26 14.7 13.02 14.58C12.78 14.46 11.98 14.19 11.04 13.35C10.31 12.7 9.81 11.89 9.67 11.65C9.53 11.4 9.65 11.28 9.77 11.16C9.88 11.05 10.02 10.87 10.14 10.73C10.26 10.6 10.31 10.5 10.39 10.33C10.47 10.17 10.43 10.02 10.37 9.9C10.31 9.78 9.81 8.58 9.6 8.09C9.4 7.61 9.19 7.68 9.03 7.67C8.88 7.66 8.71 7.66 8.55 7.66C8.38 7.66 8.11 7.72 7.88 7.97C7.65 8.22 7.02 8.81 7.02 10.01C7.02 11.21 7.9 12.37 8.02 12.53C8.15 12.7 9.8 15.24 12.32 16.29C13.98 16.98 14.6 17.03 15.4 16.91C15.89 16.83 16.9 16.29 17.11 15.68C17.32 15.07 17.32 14.55 17.26 14.44C17.2 14.32 17.03 14.25 16.78 14.13Z"/></svg>`,
  save:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 4C5 3.44772 5.44772 3 6 3H16.1716C16.4368 3 16.6912 3.10536 16.8787 3.29289L19.7071 6.12132C19.8946 6.30886 20 6.5632 20 6.82843V20C20 20.5523 19.5523 21 19 21H6C5.44772 21 5 20.5523 5 20V4Z" stroke="currentColor" stroke-width="2"/><path d="M8 3V8H15V3" stroke="currentColor" stroke-width="2"/><path d="M8 21V14H16V21" stroke="currentColor" stroke-width="2"/></svg>`,
  bell:`<span style="font-size:14px">🔔</span>`,
  crown:`<span style="font-size:14px">👑</span>`,
  check:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12L9 17L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" stroke-width="2"/><path d="M6 7L7 20C7 20.5523 7.44772 21 8 21H16C16.5523 21 17 20.5523 17 20L18 7" stroke="currentColor" stroke-width="2"/></svg>`,
};

/* ===========================================================
   MASCOT
   =========================================================== */
const MASCOT = `<img class="mascot-img" src="assets/mascot-coin.png" alt="BaatBanao mascot" />`;

/* ===========================================================
   VIEWS
   =========================================================== */
function viewHome(){
  const latestPending = state.khata.find(k => k.status === 'pending');
  return `
    <div class="hero-greeting">
      <h1>Namaste! 🙏<br/>Aaj kya likhna hai?</h1>
      ${MASCOT}
    </div>

    <button class="hero-card" onclick="navigate('vasooli')">
      <h2>Vasooli Mode 💸</h2>
      <p>Paisa bhi wapas, rishta bhi safe 😄</p>
    </button>

    <div class="secondary-row">
      <button class="sec-card" onclick="showToast('Business Reply — Coming soon 💼')">
        <h3>Business<br/>Reply 💼</h3>
        <p>Draft professional polite replies</p>
      </button>
      <button class="sec-card" onclick="showToast('Masti Message — Coming soon 😄')">
        <h3>Masti<br/>Message 😄</h3>
        <p>Fun chat &amp; sticker ideas</p>
      </button>
    </div>

    <button class="input-pill" onclick="navigate('vasooli')">
      <span>Bolo ya type karo...</span>
      <div class="mic-btn">${ICONS.mic}</div>
    </button>

    <div class="chip-row" id="home-lang-chips">
      ${['Hinglish','Hindi','Bhojpuri','English'].map(l => `
        <div class="chip ${state.settings.defaultLanguage===l?'active':''}" onclick="setDefaultLanguage('${l}')">${l}</div>
      `).join('')}
    </div>

    ${latestPending ? `
    <div class="khata-strip" onclick="navigate('khata')">
      <div class="khata-title"><span>Khata</span>${ICONS.bell}</div>
      <div class="khata-row">📒 <b>${latestPending.name}</b> — <span class="amt">${fmtMoney(latestPending.amount)}</span> pending — Remind karo</div>
    </div>` : `
    <div class="khata-strip" onclick="navigate('khata')">
      <div class="khata-title"><span>Khata</span>${ICONS.bell}</div>
      <div class="khata-row">Koi pending nahi hai. Sab clear! ✅</div>
    </div>`}
  `;
}

function setDefaultLanguage(l){
  state.settings.defaultLanguage = l;
  persist();
  renderApp();
}

function viewVasooli(){
  const s = state.vasooliForm || {
    name:'', amount:'', relation:'Dost',
    language: state.settings.defaultLanguage || 'Hinglish',
    tone: state.settings.defaultTone || 'Friendly',
    note:''
  };
  state.vasooliForm = s;

  const relations = ['Dost','Customer','Client','Student/Parent','Tenant','Shop Khata','Relative','General'];
  const languages = ['Hinglish','Hindi','Bhojpuri','English'];

  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('home')">${ICONS.back}</button>
      <h1>Vasooli Mode 💸</h1>
    </div>
    <p style="margin:0 2px;color:var(--text-secondary);font-weight:600;font-size:13.5px;">Naam, amount aur language select karo — WhatsApp-ready reminder milega.</p>

    <div class="field-block">
      <label class="field-label">Naam</label>
      <input type="text" id="f-name" placeholder="Ramesh bhai" value="${escapeHtml(s.name)}" oninput="updateForm('name', this.value)"/>
    </div>

    <div class="field-block">
      <label class="field-label">Amount</label>
      <input type="number" id="f-amount" placeholder="2500" value="${escapeHtml(s.amount)}" oninput="updateForm('amount', this.value)"/>
    </div>

    <div class="field-block">
      <label class="field-label">Relation</label>
      <select id="f-relation" onchange="updateForm('relation', this.value)">
        ${relations.map(r => `<option value="${r}" ${s.relation===r?'selected':''}>${r}</option>`).join('')}
      </select>
    </div>

    <div class="field-block">
      <label class="field-label">Language</label>
      <div class="chip-row">
        ${languages.map(l => `<div class="chip ${s.language===l?'active':''}" onclick="updateForm('language','${l}')">${l}</div>`).join('')}
      </div>
    </div>

    <div class="field-block">
      <label class="field-label">Tone</label>
      <div class="chip-row">
        ${['Friendly','Polite','Strong'].map(t => `<div class="chip ${s.tone===t?'active':''}" onclick="updateForm('tone','${t}')">${t}</div>`).join('')}
      </div>
    </div>

    <div class="field-block">
      <label class="field-label">Note (optional)</label>
      <textarea id="f-note" placeholder="Example: 2 mahine se pending hai, aaj chahiye" oninput="updateForm('note', this.value)">${escapeHtml(s.note)}</textarea>
    </div>

    <button class="primary-btn" onclick="handleGenerate()">Message Banao ✨</button>

    <div class="safety-banner">BaatBanao sirf respectful reminders banata hai. Message bhejne se pehle check/edit kar lein.</div>

    <div id="vasooli-output"></div>
  `;
}

function escapeHtml(str){
  if(str===undefined || str===null) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function updateForm(field, value){
  state.vasooliForm[field] = value;
}

function handleGenerate(){
  const s = state.vasooliForm;
  if(!s.name || !s.name.trim()){ showToast('Naam daalna zaroori hai'); return; }
  if(!s.amount || Number(s.amount) <= 0){ showToast('Sahi amount daalein'); return; }

  const combinedText = (s.name||'') + ' ' + (s.note||'');
  const outputDiv = document.getElementById('vasooli-output');

  outputDiv.innerHTML = `
    <div class="loading-box">
      <img class="loading-mascot" src="assets/mascot-thinking.webp" alt="" width="120" height="120" loading="lazy" decoding="async"/>
      <p>Dosti bachate hue hisaab bana rahe hain...</p>
    </div>
  `;

  setTimeout(()=>{
    let messages;
    let unsafeNotice = '';
    if(isUnsafe(combinedText)){
      unsafeNotice = `<div class="safety-banner">Gaali ke bina bhi strong message ban sakta hai. Yeh respectful version try karein:</div>`;
      messages = [{ label:'Strong but Respectful', text: safeAlternative(s.name, s.amount) }];
    } else {
      messages = generateMessages(s);
    }

    // save to history
    messages.forEach(m => {
      state.history.unshift({
        id: uid(), message:m.text, name:s.name, amount:Number(s.amount)||0,
        language:s.language, tone:m.label, action:'generated', copied:false, shared:false,
        createdAt: Date.now()
      });
    });
    if(state.history.length > 200) state.history = state.history.slice(0,200);
    persist();

    outputDiv.innerHTML = `
      ${unsafeNotice}
      <div class="section-title">Ready Messages</div>
      ${messages.map((m,i) => outputCard(m, i, s)).join('')}
    `;
  }, 700);
}

function outputCard(m, idx, formSnapshot){
  const taId = 'out-text-' + idx;
  const payload = encodeURIComponent(JSON.stringify(formSnapshot));
  return `
    <div class="output-card">
      <span class="tag">${m.label}</span>
      <textarea id="${taId}" rows="4">${m.text}</textarea>
      <div class="btn-row">
        <button class="ghost-btn copy" onclick="copyOutput('${taId}')">${ICONS.copy} Copy</button>
        <button class="ghost-btn whatsapp" onclick="whatsappOutput('${taId}')">${ICONS.whatsapp} WhatsApp</button>
        <button class="ghost-btn save" onclick='saveOutputToKhata(${JSON.stringify(m).replace(/'/g,"&#39;")}, ${JSON.stringify(formSnapshot).replace(/'/g,"&#39;")}, "${taId}")'>${ICONS.save} Khata</button>
      </div>
    </div>
  `;
}

function copyOutput(taId){
  const ta = document.getElementById(taId);
  navigator.clipboard?.writeText(ta.value).then(()=>{
    showToast('Copied! ✅');
  }).catch(()=>{
    ta.select(); document.execCommand('copy'); showToast('Copied! ✅');
  });
}

function whatsappOutput(taId){
  const ta = document.getElementById(taId);
  const text = encodeURIComponent(ta.value);
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function saveOutputToKhata(m, formSnapshot, taId){
  const ta = document.getElementById(taId);
  const entry = {
    id: uid(),
    name: formSnapshot.name || 'Unknown',
    phone:'',
    amount: Number(formSnapshot.amount) || 0,
    relation: formSnapshot.relation || 'General',
    status:'pending',
    dueDate:null,
    lastReminderAt: Date.now(),
    language: formSnapshot.language,
    tone: m.label,
    note: formSnapshot.note || '',
    message: ta.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.khata.unshift(entry);
  persist();
  showToast('Khata mein save ho gaya 📒');
}

function viewKhata(){
  const total = state.khata.filter(k=>k.status==='pending').reduce((a,b)=>a+Number(b.amount||0),0);
  const pendingCount = state.khata.filter(k=>k.status==='pending').length;
  const filter = state.khataFilter || 'all';
  const list = state.khata.filter(k => filter==='all' ? true : k.status===filter);

  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('home')">${ICONS.back}</button>
      <h1>Udhaar Khata</h1>
    </div>

    <div class="summary-card">
      <div class="amt">${fmtMoney(total)}</div>
      <div class="sub">${pendingCount} pending payment${pendingCount===1?'':'s'}</div>
    </div>

    <button class="primary-btn" onclick="navigate('vasooli')">Reminder Message Banao 🔔</button>

    <div class="chip-row">
      ${['all','pending','paid'].map(f => `<div class="chip ${filter===f?'active':''}" onclick="setKhataFilter('${f}')">${f==='all'?'All':f==='pending'?'Pending':'Paid'}</div>`).join('')}
    </div>

    ${list.length===0 ? `
      <div class="empty-state">
        <img class="empty-mascot" src="assets/mascot-sleeping.webp" alt="" width="180" height="180" loading="lazy" decoding="async"/>
        <p><b>Sab clear!</b> ✨<br>Coin so raha hai — koi udhaar pending nahi.</p>
      </div>
    ` : list.map(k => khataCard(k)).join('')}
  `;
}

function setKhataFilter(f){ state.khataFilter = f; renderApp(); }

function khataCard(k){
  return `
    <div class="list-card">
      <div class="row-top">
        <span class="name">${escapeHtml(k.name)}</span>
        <span class="amount">${fmtMoney(k.amount)}</span>
      </div>
      <div class="meta">${escapeHtml(k.relation||'General')} · ${k.status==='paid' ? 'Paid '+timeAgo(k.updatedAt) : (k.note ? escapeHtml(k.note) : 'Pending')}</div>
      <div class="row-top">
        <span class="status-badge ${k.status}">${k.status==='paid'?'Paid ✅':'Pending'}</span>
        <div class="btn-row" style="margin-top:0;">
          ${k.status==='pending' ? `<button class="ghost-btn" onclick="remindKhata('${k.id}')">🔔 Remind</button>
          <button class="ghost-btn save" onclick="markPaid('${k.id}')">${ICONS.check} Paid</button>` : ''}
          <button class="ghost-btn danger" onclick="deleteKhata('${k.id}')">${ICONS.trash}</button>
        </div>
      </div>
    </div>
  `;
}

function remindKhata(id){
  const k = state.khata.find(x=>x.id===id);
  if(!k) return;
  const text = k.message || generateMessages(k)[0].text;
  const encoded = encodeURIComponent(text);
  k.lastReminderAt = Date.now();
  persist();
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
  showToast('WhatsApp khul raha hai...');
}

function markPaid(id){
  const k = state.khata.find(x=>x.id===id);
  if(!k) return;
  k.status = 'paid';
  k.updatedAt = Date.now();
  persist();
  showPaidCelebration(k.name, k.amount);
  renderApp();
}

// 🎉 Celebration popup with mascot — dopamine hit for user
function showPaidCelebration(name, amount){
  const existing = document.getElementById('bb-celebrate');
  if(existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'bb-celebrate';
  el.className = 'bb-celebrate-overlay';
  el.innerHTML = `
    <div class="bb-celebrate-card">
      <img src="assets/mascot-paid.webp" alt="" width="180" height="180" loading="eager" decoding="async"/>
      <h2>Paisa aa gaya! 🎉</h2>
      <p><b>${escapeHtml(name)}</b> ne <b>${fmtMoney(amount)}</b> clear kiya</p>
      <p class="bb-celebrate-tag">Dosti safe, hisaab clear ✨</p>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 2200);
}

function deleteKhata(id){
  state.khata = state.khata.filter(x=>x.id!==id);
  persist();
  renderApp();
  showToast('Entry delete ho gayi');
}

function viewHistory(){
  const list = state.history;
  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('home')">${ICONS.back}</button>
      <h1>History</h1>
    </div>
    ${list.length===0 ? `
      <div class="empty-state">
        <img class="empty-mascot" src="assets/mascot-thinking.webp" alt="" width="180" height="180" loading="lazy" decoding="async"/>
        <p><b>Abhi tak koi message nahi banaya.</b><br>Vasooli Mode kholo aur shuru karo!</p>
      </div>
    ` : list.map(h => historyCard(h)).join('')}
    ${list.length>0 ? `<button class="ghost-btn danger" style="margin-top:6px;" onclick="clearHistory()">${ICONS.trash} Clear All History</button>` : ''}
  `;
}

function historyCard(h){
  const taId = 'hist-' + h.id;
  return `
    <div class="output-card">
      <div class="row-top" style="display:flex;justify-content:space-between;align-items:center;">
        <span class="tag">${escapeHtml(h.tone)}</span>
        <span class="meta" style="font-size:11px;color:var(--text-muted);">${timeAgo(h.createdAt)}</span>
      </div>
      <textarea id="${taId}" rows="3" readonly>${escapeHtml(h.message)}</textarea>
      <div class="btn-row">
        <button class="ghost-btn copy" onclick="copyOutput('${taId}')">${ICONS.copy} Copy</button>
        <button class="ghost-btn whatsapp" onclick="whatsappOutput('${taId}')">${ICONS.whatsapp} WhatsApp</button>
        <button class="ghost-btn danger" onclick="deleteHistoryItem('${h.id}')">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

function deleteHistoryItem(id){
  state.history = state.history.filter(h=>h.id!==id);
  persist();
  renderApp();
}
function clearHistory(){
  if(!confirm('Poori history delete karni hai?')) return;
  state.history = [];
  persist();
  renderApp();
}

function viewProfile(){
  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('home')">${ICONS.back}</button>
      <h1>Profile</h1>
    </div>
    <div class="hero-card" style="cursor:default;" onclick="">
      <h2>Guest User 🙌</h2>
      <p>Login abhi optional hai — sab kuch is device par save hai.</p>
    </div>
    <div class="settings-item"><span class="label">📒 Total Khata Entries</span><span>${state.khata.length}</span></div>
    <div class="settings-item"><span class="label">🕓 Messages Generated</span><span>${state.history.length}</span></div>
    <button class="primary-btn" onclick="navigate('settings')">Settings ⚙️</button>
    <button class="ghost-btn" onclick="showToast('Vasooli Pro — Coming soon 👑')">👑 Upgrade to Pro</button>
  `;
}

function viewSettings(){
  const s = state.settings;
  const languages = ['Hinglish','Hindi','Bhojpuri','English'];
  const tones = ['Friendly','Polite','Strong'];
  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('profile')">${ICONS.back}</button>
      <h1>Settings</h1>
    </div>

    <div class="field-block">
      <label class="field-label">Default message language</label>
      <div class="chip-row">
        ${languages.map(l => `<div class="chip ${s.defaultLanguage===l?'active':''}" onclick="setSetting('defaultLanguage','${l}')">${l}</div>`).join('')}
      </div>
    </div>

    <div class="field-block">
      <label class="field-label">Default tone</label>
      <div class="chip-row">
        ${tones.map(t => `<div class="chip ${s.defaultTone===t?'active':''}" onclick="setSetting('defaultTone','${t}')">${t}</div>`).join('')}
      </div>
    </div>

    <div class="settings-item">
      <span class="label">Messages mein emoji use karo</span>
      <div class="toggle ${s.emojiEnabled?'on':''}" onclick="toggleSetting('emojiEnabled')"><div class="knob"></div></div>
    </div>

    <div class="settings-item">
      <span class="label">Card watermark (Pro removes it)</span>
      <div class="toggle ${s.watermarkEnabled?'on':''}" onclick="toggleSetting('watermarkEnabled')"><div class="knob"></div></div>
    </div>

    <button class="ghost-btn danger" onclick="clearAllData()">${ICONS.trash} Clear all app data</button>

    <div class="divider"></div>
    <div class="settings-item"><span class="label">Privacy Policy</span><span>›</span></div>
    <div class="settings-item"><span class="label">Feedback</span><span>›</span></div>
  `;
}

function setSetting(key, val){
  state.settings[key] = val;
  persist();
  renderApp();
}
function toggleSetting(key){
  state.settings[key] = !state.settings[key];
  persist();
  renderApp();
}
function clearAllData(){
  if(!confirm('Sabhi data (Khata + History + Settings) delete karna hai? Yeh wapas nahi hoga.')) return;
  localStorage.removeItem(STORE_KEYS.khata);
  localStorage.removeItem(STORE_KEYS.history);
  localStorage.removeItem(STORE_KEYS.settings);
  location.reload();
}

/* ===========================================================
   MENU DRAWER
   =========================================================== */
function openMenu(){
  document.getElementById('overlay').classList.add('show');
  document.getElementById('drawer').classList.add('show');
}
function closeMenu(){
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
}

/* ===========================================================
   RENDER
   =========================================================== */
const ROUTES = {
  home: viewHome,
  vasooli: viewVasooli,
  khata: viewKhata,
  history: viewHistory,
  profile: viewProfile,
  settings: viewSettings
};

function renderApp(){
  const route = state.route || 'home';
  const viewFn = ROUTES[route] || viewHome;
  document.getElementById('content').innerHTML = viewFn();

  // bottom nav active state
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.route === (['home','khata','history','profile'].includes(route) ? route : ''));
  });
}

/* Init */
document.addEventListener('DOMContentLoaded', ()=>{
  const initialRoute = window.location.hash.replace('#','') || 'home';
  state.route = initialRoute;
  renderApp();
});
