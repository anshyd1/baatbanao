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
  const lang = language || 'Hinglish';
  function rnd3(arr){ return [...arr].sort(()=>Math.random()-.5).slice(0,3); }

  const FUNNY = {
    Hinglish:[
      (n,a)=>`${n} bhai, mera ${a} raat ko sapne mein aata hai — "Ghar bhej do yaar!" \u{1F602} Aaj bhej do!`,
      (n,a)=>`${n}, teri wajah se mera ${a} homesick ho gaya \u{1F62D} Roz kehta hai "Wapas aa jaa." Aaj bhej do!`,
      (n,a)=>`${n} bhai, ${a} ka Google Maps on kiya — still showing at your location \u{1F4CD}\u{1F602} Transfer karo!`,
      (n,a)=>`${n}, Google Pay ne ${a} ke liye "Pending Since Forever" badge de diya \u{1F602} Aaj clear karo!`,
      (n,a)=>`${n} bhai, IRCTC ka waiting confirm ho jaata hai lekin tera ${a} nahi aaya \u{1F602} Tu IRCTC se bhi slow hai!`,
      (n,a)=>`${n}, Zomato 30 min mein khana deta hai, Amazon same day — tera ${a} kab aayega? \u{1F602}`,
      (n,a)=>`${n} bhai, "Picture abhi baaki hai mere dost" \u{1F3AC} Aur wo picture hai ${a} transfer hone ki!`,
      (n,a)=>`${n}, "All izz well" tab hoga jab ${a} aa jaaye \u{1F602} Aaj bhej do, sab theek!`,
      (n,a)=>`${n} bhai, ${a} pe documentary bana sakta hun — "The Money That Never Came Home" \u{1F3AC} Sequel mat banana!`,
      (n,a)=>`${n}, ${a} ne mujhse complaint ki — "Woh mujhe ghar nahi aane deta" \u{1F602} Uski bail karo!`,
      (n,a)=>`${n} bhai, ${a} tere ghar permanent resident ban gaya \u{1F602} Citizenship bhi le raha hai. Deportation karo!`,
      (n,a)=>`${n}, Netflix renew ho jaata hai, EMI cut hoti hai — tera ${a} kabhi nahi aaya \u{1F602}`,
      (n,a)=>`${n} bhai, maa ne kaha "Waqt pe paisa dena achha kaam hai" \u{1F604} Maa ki baat maano — ${a} aaj!`,
      (n,a)=>`${n}, tune hi kaha tha "Bhai tu bol, main karunga" \u{1F604} Bol raha hun — ${a} aaj bhej de!`,
      (n,a)=>`${n} bhai, Diwali hai — ghar ki safai ke saath ${a} bhi clear karo \u{1FA94} Lakshmi ji khush hongi!`,
      (n,a)=>`${n}, ${a} ne WhatsApp status lagaya "Missing my owner since forever" \u{1F62D} Reunite karo aaj!`,
      (n,a)=>`${n} bhai, petrol ke daam badhte hain, season bhi change hota hai — mera ${a} nahi aata \u{1F602}`,
      (n,a)=>`${n}, UPI ne ${a} ka tracker laga diya — abhi bhi tere account ki taraf arrow hai \u{1F602}`,
    ],
    Bhojpuri:[
      (n,a)=>`${n} bhaiya, hamaar ${a} roj sapna mein aawela — "Ghar bhej da!" \u{1F602} Aaj bhej da please!`,
      (n,a)=>`${n} bhai, ${a} ke GPS on ba — "Still at ${n}'s location" show ho raha ba \u{1F602} Transfer kar da!`,
      (n,a)=>`${n} bhaiya, ${a} itna time se baaki ba ki uski dadi aa gayi \u{1F602} Ab aur mat roko!`,
      (n,a)=>`${n} bhai, hamaar ${a} tohar ghar ke permanent resident ban gaili ba \u{1F605} Kiraya bhi maangi. Bhej da!`,
      (n,a)=>`${n} bhaiya, IRCTC ke waiting confirm ho jaala, train time pe aawela — tohar ${a} kabhi nahi aail \u{1F602}`,
      (n,a)=>`${n} bhai, Amazon same day delivery deta ba — tohar ${a} kab aaii? \u{1F602}`,
      (n,a)=>`${n} bhaiya, "Dosti alag ba, hisaab alag ba" — ${a} aaj clear kar da \u{1F604}`,
      (n,a)=>`${n} bhai, maai kaheli "Waqt pe paisa dena achha kaam ba" \u{1F604} Maai ke baat maano — ${a} aaj!`,
      (n,a)=>`${n} bhaiya, ${a} ke documentary banat ba — "Wo Paisa Jo Kabhi Nahi Aail" \u{1F3AC} Sequel mat banana!`,
      (n,a)=>`${n} bhai, tohi kahelu "Bhai tu bol, karb" \u{1F604} Bol taat ba — ${a} aaj bhej da!`,
      (n,a)=>`${n} bhaiya, Diwali ba — purana hisaab clear kar da \u{1FA94} Lakshmi maiya khush hoihin!`,
      (n,a)=>`${n} bhai, ${a} emotional ho gaili ba \u{1F622} "Kab aaun ghar?" kahe rahi ba — aaj bhej ke khush kar da!`,
    ],
    Hindi:[
      (n,a)=>`${n} bhai, ${a} ne baat karna band kar diya — "Jab tak wapas nahi laata" \u{1F622} Aaj le aao!`,
      (n,a)=>`${n} ji, IRCTC ki waiting list confirm hoti hai — lekin aapka ${a} nahi aaya \u{1F604} Aaj zaroor bhejein!`,
      (n,a)=>`${n} bhai, Amazon same-day delivery deta hai — sirf aapka ${a} delivery pending hai \u{1F602}`,
      (n,a)=>`${n} ji, ${a} ek unsolved mystery ban gayi hai \u{1F50D} Aaj solve karein — transfer karein!`,
      (n,a)=>`${n} bhai, "All izz well" tab hoga jab ${a} aa jaaye \u{1F602} Aaj transfer karein!`,
      (n,a)=>`${n} ji, maa ne kaha "Udhaar jaldi wapas karo" \u{1F604} Maa ki baat maano — ${a} aaj!`,
      (n,a)=>`${n} bhai, tune hi kaha "Bhai bol, main karunga" \u{1F604} Bol raha hun — ${a} aaj bhej de!`,
      (n,a)=>`${n} ji, Diwali hai — safai ke saath ${a} bhi clear karein \u{1FA94}`,
      (n,a)=>`${n} bhai, bijli ka bill aata hai, Netflix renew hota hai — sirf ${a} kabhi nahi aaya \u{1F602}`,
      (n,a)=>`${n} ji, ${a} ne sad status lagaya — "Missing since forever" \u{1F62D} Ghar bhej do aaj!`,
    ],
    English:[
      (n,a)=>`${n} bro, my ${a} has been at your place so long it's started paying rent \u{1F602} Please evict it!`,
      (n,a)=>`${n}, GPS tracking for my ${a} — still showing at your location \u{1F4CD}\u{1F602} Please redirect it!`,
      (n,a)=>`${n} bro, Zomato delivers in 30 mins, Amazon in a day — when is my ${a} arriving? \u{1F602}`,
      (n,a)=>`${n}, my ${a} filed a missing person report \u{1F602} Help reunite us today please!`,
      (n,a)=>`${n} bro, "All izz well" only when ${a} arrives \u{1F602} Make it happen today!`,
      (n,a)=>`${n}, Netflix auto-renews, EMIs get cut — but your ${a} needs manual effort? \u{1F602}`,
      (n,a)=>`${n} bro, my ${a} is in therapy — abandonment issues \u{1F602} Please send it home!`,
      (n,a)=>`${n}, you said "bro just ask me anything" \u{1F604} Asking — ${a} please, today!`,
    ],
  };

  const FRIENDLY={Hinglish:[(n,a,nt)=>`${n}, ${a} abhi pending hai. Aaj bhej doge toh bahut help ho jayegi. Dosti apni jagah, hisaab apni jagah ${e('\u{1F604}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} bhai, ${a} yaad hai na? Aaj bhej do yaar — tension khatam, dono khush ${e('\u{1F60A}')}${nt?' — '+nt:''}`, (n,a,nt)=>`Oye ${n}! ${a} pending hai — aaj clear karo, rishta bhi solid rahega ${e('\u{1F604}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} yaar, ek chhoti reminder — ${a} suvidha ho toh aaj bhej do ${e('\u{1F60A}')}${nt?' '+nt:''}`, (n,a,nt)=>`${n} bhai, ${a} wali baat — aaj bhej do, main wait kar raha hun ${e('\u{1F604}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n}, teri yaad aayi aur ${a} ki bhi ${e('\u{1F604}')} Dono ek saath — aaj bhej do!${nt?' '+nt:''}`, (n,a,nt)=>`${n} bhai, chai peete peete ${a} bhej do — koi effort nahi lagega ${e('\u{1F60A}')}${nt?' ('+nt+')':''}`,],Hindi:[(n,a,nt)=>`${n}, ${a} abhi baaki hai. Aaj bhejoge toh bahut achha lagega ${e('\u{1F604}')}${nt?'. '+nt:''}`, (n,a,nt)=>`${n} bhai, ${a} yaad hai? Aaj bhej do, tension khatam ${e('\u{1F60A}')}${nt?' — '+nt:''}`, (n,a,nt)=>`${n} ji, ek chhoti si yaad — ${a} aaj bhej dein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n}, wo ${a} — aaj bhej do ${e('\u{1F60A}')}${nt?' '+nt:''}`, (n,a,nt)=>`${n} bhai, ${a} aaj bhej do ${e('\u{1F60A}')}${nt?' ('+nt+')':''}`,],Bhojpuri:[(n,a,nt)=>`${n} bhaiya, ${a} baaki ba. Aaj bhej da, bahut meharbani hoi. Dosti alag ba, hisaab alag ba ${e('\u{1F604}')}`, (n,a,nt)=>`${n} bhai, ${a} yaad ba na? Aaj bhej diha, rishta bhi rahee paisa bhi aaee ${e('\u{1F60A}')}`, (n,a,nt)=>`Arre ${n} bhaiya! ${a} abhi baaki ba — aaj clear kar da, bahut khushi hoi ${e('\u{1F604}')}`, (n,a,nt)=>`${n} bhaiya, suvidha ho toh ${a} aaj bhej diha — bahut upkar hoi ${e('\u{1F64F}')}`, (n,a,nt)=>`${n} bhaiya, tohar yaad aail aur ${a} ke bhi ${e('\u{1F604}')} Dono ek saath — aaj bhej da!`, (n,a,nt)=>`${n} bhai, seedha bolat ba — ${a} aaj bhej da. Rishta solid rahee ${e('\u{1F604}')}`,],English:[(n,a,nt)=>`Hey ${n}, ${a} is still pending. It'd really help if you sent it today! ${e('\u{1F604}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} buddy, quick reminder — ${a} pending. Send today when you can ${e('\u{1F60A}')}${nt?' Note: '+nt:''}`, (n,a,nt)=>`Hi ${n}! ${a} is pending. Today works? ${e('\u{1F60A}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n}, no pressure but... ${a} is pending ${e('\u{1F604}')} Today would be great!${nt?' ('+nt+')':''}`,],};
  const POLITE={Hinglish:[(n,a,nt)=>`${n}, aapka ${a} payment pending hai. Kripya jab time mile aaj bhej dein ${e('\u{1F64F}')}${nt?'. '+nt:''}`, (n,a,nt)=>`${n} ji, ek vinamra nivedan — ${a} aaj bhej dein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`Namaste ${n} ji, ${a} pending hai. Kripya aaj bhejne ka kast karein ${e('\u{1F64F}')}${nt?' '+nt:''}`, (n,a,nt)=>`${n} sahab, ${a} abhi pending hai — suvidha anusaar aaj bhej dein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} ji, ${a} abhi clear nahi hua. Kripya aaj bhejein ${e('\u{1F64F}')}${nt?' Note: '+nt:''}`, (n,a,nt)=>`Namaste ${n} ji. ${a} baaki hai — kripya aaj tak clear karein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`,],Hindi:[(n,a,nt)=>`${n} ji, ${a} abhi pending hai. Kripya aaj bhej dein ${e('\u{1F64F}')}${nt?'. '+nt:''}`, (n,a,nt)=>`${n}, aapka ${a} abhi clear nahi hua. Kripya aaj bhej dein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`Namaste ${n} ji, ek choti yaad — ${a} aaj bhejein ${e('\u{1F64F}')}${nt?' '+nt:''}`, (n,a,nt)=>`${n} sahab, ${a} ka bhugtan aaj kar dein ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} ji, aapse anurodh — ${a} aaj bhej dein. Dhanyavaad ${e('\u{1F64F}')}${nt?' '+nt:''}`,],Bhojpuri:[(n,a,nt)=>`${n} bhaiya, ${a} ke rakam abhi baaki ba. Aaj bhej dijiye ${e('\u{1F64F}')}`, (n,a,nt)=>`${n} sahab, ek nivedan ba — ${a} aaj bhej da ${e('\u{1F64F}')}`, (n,a,nt)=>`Pranam ${n} bhaiya, ${a} ke yaad dilaile ba. Aaj bhej da ${e('\u{1F64F}')}`, (n,a,nt)=>`${n} bhaiya, ${a} ka hisaab baaki ba — aaj bhej da ${e('\u{1F64F}')}`, (n,a,nt)=>`${n} bhai, ${a} ke payment abhi nahi aail ba. Aaj bhej diha ${e('\u{1F64F}')}`,],English:[(n,a,nt)=>`Hi ${n}, gentle reminder — ${a} is still pending. Please send today ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`Dear ${n}, kindly note ${a} remains unpaid. Settlement today appreciated ${e('\u{1F64F}')}${nt?' '+nt:''}`, (n,a,nt)=>`${n}, gentle reminder — ${a} is pending. Today works? ${e('\u{1F64F}')}${nt?' ('+nt+')':''}`, (n,a,nt)=>`Hi ${n}, polite follow-up on ${a}. Please send today. Thanks ${e('\u{1F64F}')}${nt?' Note: '+nt:''}`,],};
  const STRONG={Hinglish:[(n,a,nt)=>`${n}, ${a} ka payment kaafi din se pending hai. Kripya aaj tak clear kar dein.${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} bhai, ${a} bahut time se baaki hai. Aaj clear karna zaroori hai.${nt?' '+nt:''}`, (n,a,nt)=>`Final reminder ${n} — ${a} pending hai. Aaj tak nahi aaya toh problem hogi.${nt?' '+nt:''}`, (n,a,nt)=>`${n}, ab seedha bolunga — ${a} bahut din se pending hai. Aaj last chance hai.${nt?' '+nt:''}`, (n,a,nt)=>`${n} ji, ${a} ka payment overdue hai. Kripya aaj hi bhugtan karein.${nt?' ('+nt+')':''}`,],Hindi:[(n,a,nt)=>`${n} ji, ${a} kaafi samay se pending hai. Kripya aaj hi bhugtan kar dein.${nt?' '+nt:''}`, (n,a,nt)=>`${n}, ${a} ki payment bahut din se ruki hai. Aaj tak nahi aayi toh dikkat hogi.${nt?' ('+nt+')':''}`, (n,a,nt)=>`Final reminder ${n} ji — ${a} aaj tak clear karna zaroori hai.${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n} bhai, ${a} clear karna aaj zaroori hai.${nt?' '+nt:''}`,],Bhojpuri:[(n,a,nt)=>`${n} bhaiya, ${a} bahut din se baaki ba. Aaj tak clear kar dijiye, jaruri ba.`, (n,a,nt)=>`Final reminder ${n} bhaiya — ${a} aaj clear karna zaroori ba.`, (n,a,nt)=>`${n} bhai, ${a} bahut din se pending ba. Aaj nahi aaya toh aage dikkat hoi.`, (n,a,nt)=>`${n} bhaiya, ab seedha baat — ${a} kaafi din se baaki ba. Aaj bhej da.`,],English:[(n,a,nt)=>`${n}, ${a} has been pending a while. Please clear it today.${nt?' ('+nt+')':''}`, (n,a,nt)=>`Hi ${n}, final reminder — ${a} is overdue. Please clear today.${nt?' '+nt:''}`, (n,a,nt)=>`${n}, ${a} needs to be cleared today.${nt?' ('+nt+')':''}`, (n,a,nt)=>`${n}, being direct — ${a} is long overdue. Please send today.${nt?' '+nt:''}`,],};

  if(tone==='Funny'){const pool=FUNNY[lang]||FUNNY.Hinglish;const picks=rnd3(pool);return[{label:'Funny',text:picks[0](n,amt)},{label:'Funny',text:(picks[1]||picks[0])(n,amt)},{label:'Funny',text:(picks[2]||picks[0])(n,amt)}];}
  if(tone==='Polite'){const pool=POLITE[lang]||POLITE.Hinglish;const picks=rnd3(pool);return picks.map(fn=>({label:'Polite',text:fn(n,amt,noteLine)}));}
  if(tone==='Strong'||tone==='Strong but Respectful'){const pool=STRONG[lang]||STRONG.Hinglish;const picks=rnd3(pool);return picks.map(fn=>({label:'Strong but Respectful',text:fn(n,amt,noteLine)}));}
  // Default = Friendly random
  const pool=FRIENDLY[lang]||FRIENDLY.Hinglish;
  const picks=rnd3(pool);
  return picks.map(fn=>({label:'Friendly',text:fn(n,amt,noteLine)}));
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
  const _c = document.getElementById('content');
  if (_c && _c.scrollTo) _c.scrollTo(0, 0);
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
const MASCOT = `<img class="mascot-img" src="assets/mascot-coin.webp" alt="BaatBanao mascot" />`;

/* ===========================================================
   VIEWS
   =========================================================== */
function viewHome(){
  const latestPending = state.khata.find(k => k.status === 'pending');
  return `
    <div class="hero-greeting">
      <h1>Namaste! 🙏<br/>Payment reminder banao</h1>
      ${MASCOT}
    </div>

    <button class="hero-card hero-card-banner" onclick="navigate('vasooli')">
      <img class="hero-banner-img" src="assets/vasooli-hero-banner.webp" alt="" loading="eager" decoding="async" fetchpriority="high"/>
      <div class="hero-card-content">
        <h2>Vasooli Mode 💸</h2>
        <p>Naam optional hai — amount daalo, WhatsApp-ready message lo.</p>
        <span class="hero-cta-pill">Message banao →</span>
      </div>
    </button>

    <button class="input-pill" onclick="navigate('vasooli')">
      <span>Amount + tone select karke reminder banao...</span>
      <div class="mic-btn">→</div>
    </button>

    <div class="secondary-row">
      <button class="sec-card" onclick="navigate('vasooli')">
        <h3>Polite<br/>Reminder 🙏</h3>
        <p>Customer/client ke liye professional payment follow-up.</p>
      </button>
      <button class="sec-card" onclick="navigate('khata')">
        <h3>Udhaar<br/>Khata 📒</h3>
        <p>Pending entries save karo aur repeat reminder bhejo.</p>
      </button>
    </div>

    ${latestPending ? `
    <div class="khata-strip" onclick="navigate('khata')">
      <div class="khata-title"><span>Latest pending</span>${ICONS.bell}</div>
      <div class="khata-row">📒 <b>${escapeHtml(latestPending.name)}</b> — <span class="amt">${fmtMoney(latestPending.amount)}</span> pending — Remind karo</div>
    </div>` : `
    <div class="khata-strip" onclick="navigate('khata')">
      <div class="khata-title"><span>Khata</span>${ICONS.bell}</div>
      <div class="khata-row">Koi pending nahi hai. Pehla reminder save karo ✅</div>
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
    name:'', phone:'', amount:'', relation:'Dost',
    language: state.settings.defaultLanguage || 'Hinglish',
    tone: state.settings.defaultTone || 'Friendly',
    note:''
  };
  if(s.phone === undefined) s.phone = '';
  state.vasooliForm = s;

  const relations = ['Dost','Customer','Client','Student/Parent','Tenant','Shop Khata','Relative','General'];
  const languages = ['Hinglish','Hindi','Bhojpuri','English'];

  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('home')">${ICONS.back}</button>
      <h1>Vasooli Mode 💸</h1>
    </div>
    <p style="margin:0 2px;color:var(--text-secondary);font-weight:600;font-size:13.5px;">Professional flow: sirf amount required hai. Naam/number optional — direct WhatsApp bhejne ke liye number daalein.</p>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
      <div class="field-block">
        <label class="field-label">Amount <span style="color:var(--coral);">*</span></label>
        <input type="number" id="f-amount" inputmode="decimal" placeholder="2500" value="${escapeHtml(s.amount)}" oninput="updateForm('amount', this.value)" autofocus/>
      </div>

      <div class="field-block">
        <label class="field-label">Naam (optional)</label>
        <input type="text" id="f-name" placeholder="Ramesh bhai / Customer" value="${escapeHtml(s.name)}" oninput="updateForm('name', this.value)"/>
      </div>

      <div class="field-block">
        <label class="field-label">WhatsApp Number (optional)</label>
        <input type="tel" id="f-phone" inputmode="numeric" placeholder="9876543210" value="${escapeHtml(s.phone)}" oninput="updateForm('phone', this.value.replace(/[^0-9+]/g,''))" maxlength="13"/>
      </div>

      <div class="field-block">
        <label class="field-label">Relation</label>
        <select id="f-relation" onchange="updateForm('relation', this.value)">
          ${relations.map(r => `<option value="${r}" ${s.relation===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
      <div class="field-block">
        <label class="field-label">Language</label>
        <div class="chip-row">
          ${languages.map(l => `<div class="chip ${s.language===l?'active':''}" onclick="updateForm('language','${l}')">${l}</div>`).join('')}
        </div>
      </div>

      <div class="field-block">
        <label class="field-label">Tone</label>
        <div class="chip-row">
          ${['Friendly','Polite','Funny','Strong'].map(t => `<div class="chip ${s.tone===t?'active':''}" onclick="updateForm('tone','${t}')">${t}</div>`).join('')}
        </div>
      </div>
    </div>

    <div class="field-block">
      <label class="field-label">Note (optional)</label>
      <textarea id="f-note" placeholder="Example: 2 mahine se pending hai, aaj chahiye" oninput="updateForm('note', this.value)">${escapeHtml(s.note)}</textarea>
    </div>

    <button class="primary-btn" onclick="handleGenerate()">Message Banao ✨</button>

    <div class="safety-banner">Tip: Naam blank chhodoge toh message “Bhai/Customer” style mein banega. Message bhejne se pehle check/edit kar lein.</div>

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
  const s = state.vasooliForm || {};
  const amount = Number(String(s.amount || '').replace(/,/g, ''));
  if(!amount || amount <= 0){ showToast('Amount required hai — jaise 2500'); return; }

  // Naam optional rakha hai: user amount daal ke turant message bana sake.
  // Isse mobile par “button kaam nahi kar raha” wali confusion nahi hoti.
  const cleanPhone = s.phone ? String(s.phone).replace(/[^0-9]/g, '') : '';
  if(cleanPhone && !(cleanPhone.length === 10 || cleanPhone.length === 12)){
    showToast('WhatsApp number 10 digit daalo, ya blank chhod do');
    return;
  }

  const formData = {
    ...s,
    name: (s.name && s.name.trim()) ? s.name.trim() : 'Bhai',
    amount,
    phone: cleanPhone
  };
  state.vasooliForm = formData;

  const limitCheck = bbCanGenerate();
  if (!limitCheck.allowed){
    showToast(`Aaj ke ${BB_FREE_DAILY_LIMIT} free messages khatam! BaatBanao Pro lo unlimited ke liye 👑`);
    setTimeout(()=> navigate('pro'), 900);
    return;
  }

  const combinedText = (formData.name||'') + ' ' + (formData.note||'');
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
      messages = [{ label:'Strong but Respectful', text: safeAlternative(formData.name, formData.amount) }];
    } else {
      messages = generateMessages(formData);
    }

    // save to history
    messages.forEach(m => {
      state.history.unshift({
        id: uid(), message:m.text, name:formData.name, amount:Number(formData.amount)||0,
        language:formData.language, tone:m.label, action:'generated', copied:false, shared:false,
        createdAt: Date.now()
      });
    });
    if(state.history.length > 200) state.history = state.history.slice(0,200);
    persist();
    bbRecordGeneration();

    const remainingAfter = bbCanGenerate().remaining;
    const limitNotice = (!isBBPro() && remainingAfter <= 2)
      ? `<div class="safety-banner">Aaj ${remainingAfter} free message${remainingAfter===1?'':'s'} bache hain. <a href="#pro" style="color:var(--coral-dark);font-weight:800;">BaatBanao Pro</a> lo unlimited ke liye 👑</div>`
      : '';

    outputDiv.innerHTML = `
      ${unsafeNotice}
      ${limitNotice}
      <div class="section-title">Ready Messages</div>
      ${messages.map((m,i) => outputCard(m, i, formData)).join('')}
    `;
    setTimeout(()=> outputDiv.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  }, 500);
}

function outputCard(m, idx, formSnapshot){
  const taId = 'out-text-' + idx;
  const payload = encodeURIComponent(JSON.stringify(formSnapshot));
  return `
    <div class="output-card">
      <span class="tag">${m.label}</span>
      <textarea id="${taId}" rows="4">${escapeHtml(m.text)}</textarea>
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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(()=>{
      showToast('Copied! ✅');
    }).catch(()=>{
      ta.select(); document.execCommand('copy'); showToast('Copied! ✅');
    });
  } else {
    ta.select(); document.execCommand('copy'); showToast('Copied! ✅');
  }
}

function whatsappOutput(taId){
  const ta = document.getElementById(taId);
  const text = encodeURIComponent(ta.value);
  let phone = (state.vasooliForm && state.vasooliForm.phone) ? String(state.vasooliForm.phone).replace(/[^0-9]/g, '') : '';
  if (phone.length === 10) phone = '91' + phone;
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

function saveOutputToKhata(m, formSnapshot, taId){
  const ta = document.getElementById(taId);
  const entry = {
    id: uid(),
    name: formSnapshot.name || 'Bhai',
    phone: formSnapshot.phone || '',
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
  let phone = k.phone ? String(k.phone).replace(/[^0-9]/g, '') : '';
  if (phone.length === 10) phone = '91' + phone;
  const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
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
    ${isBBPro() ?
      `<div class="settings-item"><span class="label">👑 BaatBanao Pro</span><span class="status-badge paid">Active ✅</span></div>` :
      `<button class="ghost-btn" onclick="navigate('pro')">👑 Upgrade to BaatBanao Pro</button>`
    }
  `;
}

/* ===========================================================
   BAATBANAO PRO — PAYWALL (UPI + Manual Redeem Code)
   =========================================================== */
const BB_PRO_KEY = 'bb_pro_unlocked';
const BB_PRO_PLAN_KEY = 'bb_pro_plan';
const BB_DAILY_COUNT_KEY = 'bb_daily_gen_count';
const BB_DAILY_DATE_KEY = 'bb_daily_gen_date';
const BB_FREE_DAILY_LIMIT = 8;

// ⚠️ CHANGE THESE 2 VALUES before going live:
const BB_UPI_ID = 'ansh.y@ptyes';
const BB_ADMIN_WHATSAPP = '919918996096';
const BB_SECRET_SALT = 'baatbanao-2026-vasooli-secret'; // must match ADMIN_redeem_code_tool.html

function isBBPro(){
  return localStorage.getItem(BB_PRO_KEY) === '1';
}

function bbSimpleHash(str){
  let hash = 0;
  for (let i = 0; i < str.length; i++){
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function bbGenerateRedeemCode(phone, plan){
  const raw = `${phone}-${plan}-${BB_SECRET_SALT}`;
  return bbSimpleHash(raw).toString(36).toUpperCase().slice(0,6).padEnd(6,'X');
}

function bbTodayKey(){ return new Date().toISOString().slice(0,10); }

function bbCanGenerate(){
  if (isBBPro()) return { allowed:true, remaining: Infinity };
  const storedDate = localStorage.getItem(BB_DAILY_DATE_KEY);
  let count = parseInt(localStorage.getItem(BB_DAILY_COUNT_KEY) || '0', 10);
  if (storedDate !== bbTodayKey()){
    count = 0;
    localStorage.setItem(BB_DAILY_DATE_KEY, bbTodayKey());
    localStorage.setItem(BB_DAILY_COUNT_KEY, '0');
  }
  const remaining = BB_FREE_DAILY_LIMIT - count;
  return { allowed: remaining > 0, remaining: Math.max(remaining,0) };
}

function bbRecordGeneration(){
  if (isBBPro()) return;
  const check = bbCanGenerate();
  const newCount = BB_FREE_DAILY_LIMIT - check.remaining + 1;
  localStorage.setItem(BB_DAILY_DATE_KEY, bbTodayKey());
  localStorage.setItem(BB_DAILY_COUNT_KEY, String(newCount));
}

function bbBuildUpiLink(plan){
  const amount = plan === 'business' ? 499 : 149;
  const note = encodeURIComponent(`BaatBanao ${plan === 'business' ? 'Business Pack' : 'Pro'}`);
  return `upi://pay?pa=${BB_UPI_ID}&pn=BaatBanao&am=${amount}&cu=INR&tn=${note}`;
}

function bbBuildWhatsAppScreenshotLink(plan){
  const amount = plan === 'business' ? 499 : 149;
  const msg = encodeURIComponent(`Namaste! Maine BaatBanao ${plan==='business'?'Business Pack':'Pro'} (₹${amount}) ka payment kiya hai. Screenshot attach kar raha/rahi hoon. Mera phone number: `);
  return `https://wa.me/${BB_ADMIN_WHATSAPP}?text=${msg}`;
}

function viewPro(){
  return `
    <div class="page-header">
      <button class="back-btn" onclick="navigate('profile')">${ICONS.back}</button>
      <h1>BaatBanao Pro 👑</h1>
    </div>

    <div class="hero-greeting" style="text-align:center;">
      <h1 style="font-size:20px;">Vasooli bhi smart, app bhi Pro 😄</h1>
    </div>
    <p style="text-align:center;color:var(--text-secondary);font-weight:600;font-size:13.5px;margin-bottom:16px;">
      Watermark hatao, unlimited messages banao, sabse pehle naye features paao.
    </p>

    <div class="list-card" style="margin-bottom:14px;">
      <div class="row-top"><span class="name">BaatBanao Pro</span><span class="amount">₹149 lifetime</span></div>
      <div class="meta">✅ Unlimited generation (free = ${BB_FREE_DAILY_LIMIT}/din)<br/>✅ No watermark on cards<br/>✅ Sab tone/language unlock<br/>✅ Priority AI (aane wale update mein)</div>
      <button class="primary-btn" style="margin-top:10px;" onclick="bbStartPurchase('pro')">₹149 mein Unlock Karo</button>
    </div>

    <div class="list-card" style="margin-bottom:14px;">
      <div class="row-top"><span class="name">Business Pack</span><span class="amount">₹499 lifetime</span></div>
      <div class="meta">✅ Sab kuch Pro jaisa +<br/>✅ Multiple business profiles<br/>✅ Bulk-safe reminder queue<br/>✅ Business template packs</div>
      <button class="primary-btn" style="margin-top:10px;background:var(--coral-dark);" onclick="bbStartPurchase('business')">₹499 mein Unlock Karo</button>
    </div>

    <div id="bb-pay-step" style="display:none;">
      <div class="field-block">
        <label class="field-label">Step 1 — UPI se Payment Karo</label>
        <button class="ghost-btn" id="bb-upi-btn">📲 UPI se Pay Karo</button>
      </div>
      <div class="field-block">
        <label class="field-label">Step 2 — Screenshot Bhejo</label>
        <button class="ghost-btn" id="bb-wa-btn">💬 WhatsApp par Screenshot Bhejo</button>
      </div>
      <div class="field-block">
        <label class="field-label">Step 3 — Code Daalo (verify hone ke baad milega)</label>
        <input type="tel" id="bb-phone-input" placeholder="Apna WhatsApp number (10 digit)" maxlength="10"/>
        <input type="text" id="bb-code-input" placeholder="6-digit unlock code" maxlength="6" style="margin-top:8px;text-transform:uppercase;"/>
        <button class="primary-btn" style="margin-top:10px;" onclick="bbRedeemCode()">✅ Unlock Karo</button>
        <div id="bb-redeem-msg" style="margin-top:8px;font-weight:700;font-size:13px;"></div>
      </div>
    </div>

    <div class="safety-banner">🙏 BaatBanao ek writing assistant hai, recovery agency nahi. Payment 100% manual-verified hai, koi auto-debit nahi hoga.</div>
  `;
}

let bbSelectedPlan = 'pro';
function bbStartPurchase(plan){
  bbSelectedPlan = plan;
  const step = document.getElementById('bb-pay-step');
  step.style.display = 'block';
  step.scrollIntoView({behavior:'smooth'});
  document.getElementById('bb-upi-btn').onclick = () => { window.location.href = bbBuildUpiLink(plan); };
  document.getElementById('bb-wa-btn').onclick = () => { window.open(bbBuildWhatsAppScreenshotLink(plan), '_blank'); };
}

function bbRedeemCode(){
  const phone = document.getElementById('bb-phone-input').value.replace(/\D/g,'');
  const code = document.getElementById('bb-code-input').value.trim().toUpperCase();
  const msgEl = document.getElementById('bb-redeem-msg');
  if (phone.length !== 10){ msgEl.textContent = '⚠️ Sahi 10-digit number daalo.'; msgEl.style.color = '#C0392B'; return; }
  const expected = bbGenerateRedeemCode(phone, bbSelectedPlan);
  if (expected === code){
    localStorage.setItem(BB_PRO_KEY, '1');
    localStorage.setItem(BB_PRO_PLAN_KEY, bbSelectedPlan);
    msgEl.textContent = '🎉 BaatBanao Pro Unlock ho gaya! Dhanyavaad.';
    msgEl.style.color = '#247C32';
    setTimeout(()=> navigate('profile'), 1400);
  } else {
    msgEl.textContent = '❌ Code galat hai. Sahi phone number check karo jisse screenshot bheja tha.';
    msgEl.style.color = '#C0392B';
  }
}

function viewSettings(){
  const s = state.settings;
  const languages = ['Hinglish','Hindi','Bhojpuri','English'];
  const tones = ['Friendly','Polite','Funny','Strong'];
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
      <span class="label">Card watermark ${isBBPro() ? '(Pro — removed ✅)' : '🔒 Pro removes it'}</span>
      <div class="toggle ${(s.watermarkEnabled && !isBBPro())?'on':''}" onclick="${isBBPro() ? `showToast('Pro users ke liye watermark already off hai 👑')` : `toggleSetting('watermarkEnabled')`}"><div class="knob"></div></div>
    </div>

    <div class="settings-item" onclick="navigate('pro')" style="cursor:pointer;">
      <span class="label">👑 BaatBanao Pro</span>
      <span>${isBBPro() ? 'Active ✅' : 'Upgrade ›'}</span>
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
  settings: viewSettings,
  pro: viewPro,
  chat: () => '<div id="chatMount"></div>',
  connect: () => '<div id="chatMount"></div>'
};

function renderApp(){
  const route = state.route || 'home';
  // Chat routes handled by chat-ui.js separately
  if (route === 'chat' || route === 'connect') {
    // Make sure Firebase starts loading the moment the user navigates to
    // Chat, in case it hasn't already (e.g. idle callback hasn't fired
    // yet on a very slow connection).
    if (typeof window.BB_loadFirebase === 'function') window.BB_loadFirebase();
    document.getElementById('content').innerHTML = '';
    if (typeof window.renderChatView === 'function') {
      window.renderChatView(route === 'connect' ? 'connect' : 'list');
    } else {
      // Firebase not loaded yet — show loader
      document.getElementById('content').innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <img src="assets/mascot-thinking.webp" alt="" width="100" height="100"/>
          <p style="margin-top:14px; font-weight:700; color:#75615C;">Chat connect ho raha hai...</p>
        </div>`;
    }
    document.querySelectorAll('.nav-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.route === 'chat');
    });
    return;
  }
  const viewFn = ROUTES[route] || viewHome;
  document.getElementById('content').innerHTML = viewFn();

  // bottom nav active state
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.route === (['home','khata','history','profile','chat'].includes(route) ? route : ''));
  });
}

/* Init */
function initApp() {
  const initialRoute = window.location.hash.replace('#','') || 'home';
  state.route = initialRoute;
  renderApp();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
