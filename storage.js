/* ===========================================================
   BaatBanao — storage.js
   Sirf data ka kaam — LocalStorage read/write/schema
   App logic, UI, views — kuch nahi hai yahan
   =========================================================== */

const STORE_KEYS = {
  khata:    'bb_khata',
  history:  'bb_history',
  settings: 'bb_settings',
};

/* --- Read --- */
function loadStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    return fallback;
  }
}

/* --- Write --- */
function saveStore(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* --- Default Khata entry (demo data) --- */
function defaultKhata() {
  return [{
    id:       uid(),
    name:     'Ramesh bhai',
    phone:    '',
    amount:   2500,
    relation: 'Dost',
    status:   'pending',
    language: 'Hinglish',
    tone:     'Friendly',
    note:     '2 mahine se pending',
    message:  '',
    dueDate:        null,
    lastReminderAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }];
}

/* --- App State (single source of truth) --- */
let state = {
  khata:    loadStore(STORE_KEYS.khata,    defaultKhata()),
  history:  loadStore(STORE_KEYS.history,  []),
  settings: loadStore(STORE_KEYS.settings, {
    defaultLanguage: 'Hinglish',
    defaultTone:     'Friendly',
    emojiEnabled:    true,
    watermarkEnabled: true,
  }),
  route:       'home',
  routeParams: {},
  vasooliForm: null,
  khataFilter: 'all',
};

/* --- Persist all state to LocalStorage --- */
function persist() {
  saveStore(STORE_KEYS.khata,    state.khata);
  saveStore(STORE_KEYS.history,  state.history);
  saveStore(STORE_KEYS.settings, state.settings);
}

/* --- Khata helpers --- */
function khataAdd(entry) {
  state.khata.unshift(entry);
  if (state.khata.length > 500) state.khata = state.khata.slice(0, 500);
  persist();
}

function khataUpdate(id, patch) {
  const idx = state.khata.findIndex(k => k.id === id);
  if (idx === -1) return;
  state.khata[idx] = { ...state.khata[idx], ...patch, updatedAt: Date.now() };
  persist();
}

function khataDelete(id) {
  state.khata = state.khata.filter(k => k.id !== id);
  persist();
}

/* --- History helpers --- */
function historyAdd(entry) {
  state.history.unshift(entry);
  if (state.history.length > 200) state.history = state.history.slice(0, 200);
  persist();
}

function historyDelete(id) {
  state.history = state.history.filter(h => h.id !== id);
  persist();
}

function historyClear() {
  state.history = [];
  persist();
}

/* --- Settings helpers --- */
function settingSet(key, val) {
  state.settings[key] = val;
  persist();
}

function settingToggle(key) {
  state.settings[key] = !state.settings[key];
  persist();
}

/* --- Utility --- */
function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmtMoney(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'abhi abhi';
  if (min < 60) return min + ' min pehle';
  const hr = Math.floor(min / 60);
  if (hr < 24)  return hr + ' ghante pehle';
  return Math.floor(hr / 24) + ' din pehle';
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m])
  );
}

/* --- Pro tier keys (used by pro.js + app.js both) --- */
const BB_PRO_KEY        = 'bb_pro_unlocked';
const BB_PRO_PLAN_KEY   = 'bb_pro_plan';
const BB_DAILY_CNT_KEY  = 'bb_daily_gen_count';
const BB_DAILY_DATE_KEY = 'bb_daily_gen_date';
const BB_FREE_DAILY_LIMIT = 8;
const BB_UPI_ID           = 'ansh.y@ptyes';
const BB_ADMIN_WA         = '919918996096';
const BB_SECRET_SALT      = 'baatbanao-2026-vasooli-secret';

function isBBPro() {
  return localStorage.getItem(BB_PRO_KEY) === '1';
}

function bbTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function bbCanGenerate() {
  if (isBBPro()) return { allowed: true, remaining: Infinity };
  const storedDate = localStorage.getItem(BB_DAILY_DATE_KEY);
  let count = parseInt(localStorage.getItem(BB_DAILY_CNT_KEY) || '0', 10);
  if (storedDate !== bbTodayKey()) {
    count = 0;
    localStorage.setItem(BB_DAILY_DATE_KEY, bbTodayKey());
    localStorage.setItem(BB_DAILY_CNT_KEY, '0');
  }
  const remaining = BB_FREE_DAILY_LIMIT - count;
  return { allowed: remaining > 0, remaining: Math.max(remaining, 0) };
}

function bbRecordGeneration() {
  if (isBBPro()) return;
  const { remaining } = bbCanGenerate();
  const newCount = BB_FREE_DAILY_LIMIT - remaining + 1;
  localStorage.setItem(BB_DAILY_DATE_KEY, bbTodayKey());
  localStorage.setItem(BB_DAILY_CNT_KEY, String(newCount));
}

function bbSimpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function bbGenerateRedeemCode(phone, plan) {
  const raw = `${phone}-${plan}-${BB_SECRET_SALT}`;
  return bbSimpleHash(raw).toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X');
}
