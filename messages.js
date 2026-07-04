/* ===========================================================
   BaatBanao — messages.js
   Sirf message templates — koi UI nahi, koi routing nahi
   Jitne zyada variations, utna zyada viral 🔥
   =========================================================== */

/* ===========================================================
   SAFETY FILTER
   =========================================================== */
const UNSAFE_WORDS = [
  'gaali','madarchod','behenchod','chutiya','bhosdi','randi',
  'saale','kutte','harami','dhamki','maar','jail bhej',
  'police bulaunga','badnaam','beizzati','threat','kill','laat','thappad'
];

function isUnsafe(text) {
  if (!text) return false;
  return UNSAFE_WORDS.some(w => text.toLowerCase().includes(w));
}

function safeAlternative(name, amount) {
  const n = name || 'Bhai';
  const amt = fmtMoney(amount || 0);
  return `${n}, payment kaafi din se pending hai (${amt}). Kripya aaj clear kar do. Dosti apni jagah, hisaab apni jagah 🙏`;
}

/* ===========================================================
   HELPER
   =========================================================== */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  const result = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) result.push(copy[i]);
  return result;
}

/* ===========================================================
   FRIENDLY — 8-10 lines per language, har baar naya
   =========================================================== */
const FRIENDLY = {

  Hinglish: [
    (n,amt,note) => `${n}, ${amt} abhi pending hai. Aaj bhej doge toh bahut help ho jayegi. Dosti apni jagah, hisaab apni jagah 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} bhai, ${amt} yaad hai na? Aaj bhej do yaar — tension khatam, dono khush 😊${note?' — '+note:''}`,
    (n,amt,note) => `Oye ${n}! ${amt} pending hai — aaj clear karo, rishta bhi solid rahega hisaab bhi 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} yaar, ${amt} ki ek chhoti reminder — suvidha ho toh aaj bhej do 😊${note?' Note: '+note:''}`,
    (n,amt,note) => `Bhai ${n}, wo ${amt} wali baat — aaj bhej do, main wait kar raha hun 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} ji, ${amt} pending hai — aaj bhejoge toh bahut acha lagega 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Hey ${n}! ${amt} abhi bhi pending hai — aaj clear karo toh dono ko chain milega 😊${note?' '+note:''}`,
    (n,amt,note) => `${n} bhai, ek kaam karo aaj — ${amt} bhej do. Bas itna hi 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, teri yaad aayi aur ${amt} ki bhi 😄 Dono ek saath yaad aate hain — aaj bhej do!${note?' '+note:''}`,
    (n,amt,note) => `${n} bhai, chai peete peete ${amt} bhej do — koi effort nahi lagega 😊${note?' ('+note+')':''}`,
  ],

  Hindi: [
    (n,amt,note) => `${n}, ${amt} abhi baaki hai. Aaj bhejoge toh bahut achha lagega 😄${note?'. '+note:''}`,
    (n,amt,note) => `${n} bhai, ${amt} yaad hai? Aaj bhej do, dono ki tension khatam 😊${note?' — '+note:''}`,
    (n,amt,note) => `${n} ji, ek chhoti si yaad — ${amt} aaj tak bhej dein 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, wo ${amt} — aaj suvidha ho toh bhej do, bahut meherbani hogi 😊${note?' '+note:''}`,
    (n,amt,note) => `${n} bhai, ${amt} pending hai — aaj bhej ke hisaab saaf kar lo 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `Bhai ${n}, ${amt} ki baat karna thoda awkward lagta hai — par karna padega 😄 Aaj bhej do!${note?' '+note:''}`,
    (n,amt,note) => `${n}, dosti mein seedha bolunga — ${amt} aaj bhej do 😊${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} ji, ${amt} abhi pending hai. Jab bhi time mile, aaj tak bhejein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n} bhai, ${amt} wala hisaab — aaj nipta do, kal ki tension khatam 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, ek kaam karo aaj — ${amt} bhej do. Shukriya pehle se! 😊${note?' '+note:''}`,
  ],

  Bhojpuri: [
    (n,amt,note) => `${n} bhaiya, ${amt} baaki ba. Aaj bhej da, bahut meharbani hoi. Dosti alag ba, hisaab alag ba 😄`,
    (n,amt,note) => `${n} bhai, ${amt} yaad ba na? Aaj bhej diha, rishta bhi rahee paisa bhi aaee 😊`,
    (n,amt,note) => `Arre ${n} bhaiya! ${amt} abhi baaki ba — aaj clear kar da, bahut khushi hoi 😄`,
    (n,amt,note) => `${n} bhaiya, suvidha ho toh ${amt} aaj bhej diha — bahut upkar hoi 🙏`,
    (n,amt,note) => `${n} bhai, ek kaam kareda aaj — ${amt} bhej da, sab theek ho jai 😊`,
    (n,amt,note) => `${n} bhaiya, tohar yaad aail aur ${amt} ke bhi yaad aail 😄 Dono ek saath — aaj bhej da!`,
    (n,amt,note) => `${n} bhai, chai pite pite ${amt} bhej da — kono takleef nahi hoi 😊`,
    (n,amt,note) => `${n} bhaiya, ${amt} ke rakam — aaj suvidha ho toh de diha. Bahut shukriya 🙏`,
    (n,amt,note) => `${n} bhai, seedha bolat ba — ${amt} aaj bhej da. Rishta solid rahee 😄`,
    (n,amt,note) => `${n} bhaiya, ${amt} ke yaad dilaile ba humka. Aaj toh bhej da yaar 😊`,
  ],

  English: [
    (n,amt,note) => `Hey ${n}, ${amt} is still pending. It'd really help if you could send it today! 😄${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} buddy, quick reminder — ${amt} pending. Send it today when you can 😊${note?' Note: '+note:''}`,
    (n,amt,note) => `Hi ${n}! Just a gentle nudge — ${amt} is pending. Today works? 😊${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, that ${amt} — could you clear it today? Thanks a ton! 😄${note?' '+note:''}`,
    (n,amt,note) => `Hey ${n}! ${amt} is still out there — send it home today 😊${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} bro, remembered you and remembered the ${amt} 😄 Both at the same time — send it today!${note?' '+note:''}`,
    (n,amt,note) => `${n}, no pressure but... ${amt} is pending 😄 Today would be great!${note?' ('+note+')':''}`,
    (n,amt,note) => `Hi ${n}, hope you're good! Small thing — ${amt} is pending. Send today? 😊${note?' '+note:''}`,
  ],
};

/* ===========================================================
   POLITE — 8-10 lines per language
   =========================================================== */
const POLITE = {

  Hinglish: [
    (n,amt,note) => `${n}, aapka ${amt} payment pending hai. Kripya jab time mile aaj bhej dein 🙏${note?'. '+note:''}`,
    (n,amt,note) => `${n} ji, ek vinamra nivedan — ${amt} aaj bhej dein, bahut sahayata hogi 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Namaste ${n} ji, ${amt} pending hai. Kripya aaj tak bhejna ho sake toh zaroor bhejein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n} sahab, ${amt} ka payment abhi pending hai — suvidha anusaar aaj bhej dein 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} ji, aapka ${amt} abhi clear nahi hua. Kripya aaj bhejein, dhanyavaad 🙏${note?' Note: '+note:''}`,
    (n,amt,note) => `${n}, ek choti si reminder — ${amt} aaj tak bhej dein. Bahut aabhar hoga 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} ji, aapse nivedan hai — ${amt} ka payment aaj kar dein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n} sahab, ${amt} abhi bhi baaki hai. Kripya aaj suvidha anusaar bhej dein 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, seedha bol raha hun — ${amt} aaj bhej do, bahut meherbani hogi 🙏${note?' '+note:''}`,
    (n,amt,note) => `Namaste ${n} ji. ${amt} ka hisaab baaki hai — kripya aaj tak clear karein 🙏${note?' ('+note+')':''}`,
  ],

  Hindi: [
    (n,amt,note) => `${n} ji, ${amt} abhi pending hai. Kripya aaj bhej dein, sahayata hogi 🙏${note?'. '+note:''}`,
    (n,amt,note) => `${n}, aapka ${amt} abhi clear nahi hua. Kripya suvidha anusaar aaj bhej dein 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Namaste ${n} ji, ek choti yaad — ${amt} aaj bhejein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n} sahab, ${amt} ka bhugtan aaj kar dein, bahut upkar hoga 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} ji, ek vinamra nivedan — ${amt} ka payment aaj kar dein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n}, ${amt} baaki hai — kripya jaldi suvidha anusaar bhej dein 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} sahab, ${amt} ka hisaab abhi pending hai. Aaj tak clear karein 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n} ji, aapse anurodh hai — ${amt} aaj bhej dein. Dhanyavaad 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, main jaanta/jaanti hun aap bhool gaye honge — ${amt} aaj bhej dein 🙏${note?' '+note:''}`,
    (n,amt,note) => `Namaste ${n} ji. ${amt} pending hai. Kripya aaj tak clear karein 🙏${note?' ('+note+')':''}`,
  ],

  Bhojpuri: [
    (n,amt,note) => `${n} bhaiya, ${amt} ke rakam abhi baaki ba. Aaj bhej dijiye, bahut meharbani hoi 🙏`,
    (n,amt,note) => `${n} sahab, ek nivedan ba — ${amt} aaj bhej da, bahut upkar hoi 🙏`,
    (n,amt,note) => `Pranam ${n} bhaiya, ${amt} ke yaad dilaile ba. Aaj bhej da kripaya 🙏`,
    (n,amt,note) => `${n} ji, ${amt} baaki ba. Aaj bhejla ho sake toh bahut meharbani 🙏`,
    (n,amt,note) => `${n} bhaiya, ${amt} ka hisaab baaki ba — aaj suvidha se bhej da 🙏`,
    (n,amt,note) => `${n} sahab, anurodh ba — ${amt} aaj tak bhej diha. Dhanyabad 🙏`,
    (n,amt,note) => `${n} bhaiya, seedha baat ba — ${amt} aaj bhej da. Bahut upkar hoi 🙏`,
    (n,amt,note) => `Pranam ${n} ji. ${amt} pending ba. Kripya aaj tak clear kar diha 🙏`,
    (n,amt,note) => `${n} bhai, ${amt} ke payment abhi nahi aail ba. Aaj bhej diha 🙏`,
    (n,amt,note) => `${n} bhaiya, main jaanit ba bhool gail raheu — ${amt} aaj bhej da 🙏`,
  ],

  English: [
    (n,amt,note) => `Hi ${n}, this is a gentle reminder that ${amt} is still pending. Please send it today 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Dear ${n}, kindly note that ${amt} remains unpaid. Settlement today would be appreciated 🙏${note?' '+note:''}`,
    (n,amt,note) => `${n}, I hope you're well. Gentle reminder — ${amt} is pending. Today works? 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Hi ${n}, just a polite follow-up on the ${amt} payment. Please do send it today 🙏${note?' Note: '+note:''}`,
    (n,amt,note) => `${n}, no rush but — ${amt} is still pending. Whenever you can, today preferably 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `Dear ${n}, I understand you may have forgotten — ${amt} is pending. Please clear today 🙏${note?' '+note:''}`,
    (n,amt,note) => `Hi ${n}, quick polite note — ${amt} outstanding. Please settle today 🙏${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, requesting you to clear the ${amt} today if possible. Thank you 🙏${note?' '+note:''}`,
  ],
};

/* ===========================================================
   STRONG — 8 lines per language
   =========================================================== */
const STRONG = {

  Hinglish: [
    (n,amt,note) => `${n}, ${amt} ka payment kaafi din se pending hai. Kripya aaj tak clear kar dein.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} bhai, ${amt} bahut time se baaki hai. Aaj clear karna zaroori hai.${note?' '+note:''}`,
    (n,amt,note) => `${n}, ${amt} clear karna aaj zaroori hai. Zyada wait theek nahi rahega.${note?' ('+note+')':''}`,
    (n,amt,note) => `Final reminder ${n} — ${amt} pending hai. Aaj tak nahi aaya toh aage problem hogi.${note?' '+note:''}`,
    (n,amt,note) => `${n} ji, ${amt} ka payment overdue hai. Kripya aaj hi bhugtan karein.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, ab seedha bolunga — ${amt} bahut din se pending hai. Aaj last chance hai.${note?' '+note:''}`,
    (n,amt,note) => `${n} bhai, ${amt} ka koi jawab nahi tha abhi tak. Aaj zaroor bhej do.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, hisaab pending rakhna theek nahi — ${amt} aaj clear karo.${note?' '+note:''}`,
  ],

  Hindi: [
    (n,amt,note) => `${n} ji, ${amt} kaafi samay se pending hai. Kripya aaj hi bhugtan kar dein.${note?' '+note:''}`,
    (n,amt,note) => `${n}, ${amt} ki payment bahut din se ruki hai. Aaj tak nahi aaya toh dikkat hogi.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} bhai, ${amt} clear karna aaj zaroori hai.${note?' '+note:''}`,
    (n,amt,note) => `Final reminder ${n} ji — ${amt} aaj tak clear karna zaroori hai.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, ab seedha bolunga — ${amt} bahut din se pending hai. Aaj bhej dein.${note?' '+note:''}`,
    (n,amt,note) => `${n} ji, hisaab kaafi samay se pending hai. Aaj last chance samjhein.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n} bhai, ${amt} ka jawab nahi mila abhi tak. Aaj zaroor bhejein.${note?' '+note:''}`,
    (n,amt,note) => `${n}, rishi-nata rishta alag hota hai, hisaab alag — ${amt} aaj clear karein.${note?' ('+note+')':''}`,
  ],

  Bhojpuri: [
    (n,amt,note) => `${n} bhaiya, ${amt} bahut din se baaki ba. Aaj tak clear kar dijiye, jaruri ba.`,
    (n,amt,note) => `${n} bhai, ${amt} ke payment bahut time se ruka ba. Aaj le aao.`,
    (n,amt,note) => `Final reminder ${n} bhaiya — ${amt} aaj clear karna zaroori ba.`,
    (n,amt,note) => `${n}, ${amt} bahut din se pending ba. Aaj nahi aaya toh aage dikkat hoi.`,
    (n,amt,note) => `${n} bhaiya, ab seedha baat — ${amt} kaafi din se baaki ba. Aaj bhej da.`,
    (n,amt,note) => `${n} bhai, hisaab alag ba, dosti alag — ${amt} aaj clear kar da.`,
    (n,amt,note) => `${n} bhaiya, ${amt} ke koi jawab nahi aail abhi tak. Aaj zaroor bhej da.`,
    (n,amt,note) => `${n}, ${amt} aaj last chance — please bhej da bhaiya.`,
  ],

  English: [
    (n,amt,note) => `${n}, the ${amt} payment has been pending for a while. Please clear it today.${note?' ('+note+')':''}`,
    (n,amt,note) => `Hi ${n}, this is a final reminder — ${amt} is overdue. Please clear it today.${note?' '+note:''}`,
    (n,amt,note) => `${n}, ${amt} is still outstanding and needs to be cleared today.${note?' ('+note+')':''}`,
    (n,amt,note) => `Dear ${n}, ${amt} has been pending too long. Please settle today — further delay won't work.${note?' '+note:''}`,
    (n,amt,note) => `${n}, I'll be direct — ${amt} is long overdue. Please send it today.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, no more waiting on ${amt}. Please clear it today.${note?' '+note:''}`,
    (n,amt,note) => `Hi ${n}, ${amt} has been pending way too long. Today is the deadline.${note?' ('+note+')':''}`,
    (n,amt,note) => `${n}, friendship is different, accounts are different — ${amt} please today.${note?' '+note:''}`,
  ],
};

/* ===========================================================
   FUNNY — 60+ lines per language, 8 patterns
   =========================================================== */
const FUNNY = {

  Hinglish: [
    // 1. Sapne wala (8)
    (n,amt) => `${n} bhai, mera ${amt} raat ko sapne mein aata hai aur kehta hai "Ghar bhej do yaar!" 😂 Please aaj bhej do, hum dono ko chain mile!`,
    (n,amt) => `${n}, teri wajah se mera ${amt} homesick ho gaya hai 😭 Roz sapne mein kehta hai "Wapas aa jaa." Aaj bhej do!`,
    (n,amt) => `${n} bhai, mera ${amt} tere ghar permanent resident ban gaya 😂 Ab citizenship bhi le raha hai. Please deportation karo aaj!`,
    (n,amt) => `Yaar ${n}, ${amt} ne mujhse baat karna band kar diya 😅 "Jab tak tu mujhe wapas nahi laata, teri side nahi." Aaj bhej do!`,
    (n,amt) => `${n} bhai, ${amt} ne Instagram pe sad status lagaya — "Missing my owner since forever" 😭 Reunite karo aaj!`,
    (n,amt) => `${n}, mera ${amt} roz subah uthke mujhe call karta hai — "Kab aaun ghar?" 😢 Aaj bhej ke khush kar do!`,
    (n,amt) => `${n} bhai, ${amt} yoga kar raha hai — "Let go, let go" bol raha hai 😂 Main nahi bhoolunga — aaj bhej do!`,
    (n,amt) => `${n}, mera ${amt} teri jagah ka weather forecast dekh raha hai — "Permanently settled" 😂 Kab shift hoga?`,

    // 2. Tech/UPI twist (8)
    (n,amt) => `${n}, ${amt} ka Google Maps live location on kiya — still showing at your location 📍😂 Transfer karo please!`,
    (n,amt) => `${n} bhai, UPI ne ${amt} ka tracker laga diya — abhi bhi tere account ki taraf arrow 😂 Redirect kar do!`,
    (n,amt) => `${n}, mera ${amt} tere phone mein app ki tarah install ho gaya hai permanently 😅 Uninstall ka option hai — NEFT/UPI press karo!`,
    (n,amt) => `${n} bhai, Google Pay ne ${amt} ke liye "Pending Since Forever" ka badge de diya 😂 Aaj clear karo!`,
    (n,amt) => `${n}, ${amt} ka Aadhar update pending hai — address change teri jagah se meri jagah karna hai 😂 Aaj transfer karo!`,
    (n,amt) => `${n} bhai, mera ${amt} tere digital wallet mein "Favourite" save ho gaya hai 😂 Unfavourite karo — bhej do!`,
    (n,amt) => `${n}, WhatsApp ne ${amt} ki delivery pe blue tick de diya — received tha — par returned nahi hua 😂 Return karo aaj!`,
    (n,amt) => `${n} bhai, ${amt} ka ping aaya — "I am still here. Come get me." 😂 Jaldi aao — transfer karo!`,

    // 3. Filmy twist (7)
    (n,amt) => `${n} bhai, "Picture abhi baaki hai mere dost" 🎬 Aur wo picture hai ${amt} transfer hone ki. Action!`,
    (n,amt) => `${n}, "Ek baar jo maine commitment ki..." tune ${amt} dene ki commitment ki thi 😄 Ab Salman style mein nibhao!`,
    (n,amt) => `${n} bhai, "Don ko pakadna mushkil hi nahi, namumkin hai" — lekin ${amt} pakadna bahut mumkin hai 😂 Aaj bhej do!`,
    (n,amt) => `${n}, "Bade bade deshon mein..." ${amt} wali chhoti cheez hoti rehti hai 😄 Aaj ho jaaye?`,
    (n,amt) => `${n} bhai, "All izz well" tab hoga jab ${amt} aa jaaye 😂 Aaj bhej do, sab theek ho jayega!`,
    (n,amt) => `${n}, "Ye dil maange more" — lekin pehle ${amt} toh do 😄 Basic demand hai bhai!`,
    (n,amt) => `${n} bhai, "Mogambo khush hua" wala moment chahiye — ${amt} transfer hone ke baad 😂 Aaj kar do!`,

    // 4. Comparison/Roast (8)
    (n,amt) => `${n} bhai, IRCTC ka waiting list confirm ho jaata hai lekin tera ${amt} nahi aaya 😂 Tu IRCTC se bhi slow hai!`,
    (n,amt) => `${n}, Jio ka recharge expire hota hai, light bill aata hai — lekin ${amt} kabhi nahi aaya 😄 Bills se bhi unreliable tu!`,
    (n,amt) => `${n} bhai, Amazon same-day delivery deta hai, Zomato 30 min mein khana — tera ${amt} kab aayega? 😂`,
    (n,amt) => `${n}, petrol ke daam badhte hain, season change hota hai — mera ${amt} nahi aata 😂 Tu India ki economy se bhi unpredictable!`,
    (n,amt) => `${n} bhai, WhatsApp blue tick aata hai, delivery bhi hoti hai — sirf tera ${amt} delivery pending hai 😂`,
    (n,amt) => `${n}, baarish time pe aati hai, exam date time pe — lekin tera ${amt} kabhi nahi 😄 Nature bhi tujhse better!`,
    (n,amt) => `${n} bhai, Swiggy driver 20 minute mein aata hai — tu ${amt} leke kab aayega? 😂`,
    (n,amt) => `${n}, Netflix subscription renew ho jaata hai, EMI cut hoti hai — lekin tera ${amt} manual hi deta nahi 😂`,

    // 5. Savage Safe (7)
    (n,amt) => `${n} bhai, ${amt} pe ek documentary bana sakta hun — "The Money That Never Came Home" 🎬 Sequel mat banana — aaj bhej do!`,
    (n,amt) => `${n}, ${amt} ka world record ban raha hai — "Longest pending payment by a friend" 🏆 Record todne ka time hai!`,
    (n,amt) => `${n} bhai, ${amt} ek unsolved mystery ban gayi hai 🔍 Sherlock nahi chahiye — bas transfer karo!`,
    (n,amt) => `${n}, scientist log ${amt} ko extinct species maan rahe hain 😂 Prove karo — aaj bhej ke!`,
    (n,amt) => `${n} bhai, ${amt} ke baare mein autobiography likhne ka plan hai 😄 Happy ending de do — aaj bhej do!`,
    (n,amt) => `${n}, ${amt} ki file NASA ke paas hai — "Unidentified Object in Friend's Account" 😂 Identify karo!`,
    (n,amt) => `${n} bhai, ${amt} ke liye "Ripley's Believe It or Not" contact kar rahe hain 😂 Aaj aa jaaye please!`,

    // 6. Personification (6)
    (n,amt) => `${n} bhai, mera ${amt} bahut emotional ho gaya hai 😢 "Kab aaun ghar?" puchh raha hai. Aaj bhej ke reunite karo!`,
    (n,amt) => `${n}, ${amt} ne mujhse complaint ki — "Woh mujhe ghar nahi aane deta" 😂 Please uski bail karo!`,
    (n,amt) => `${n} bhai, ${amt} therapy le raha hai — "Abandonment issues" 😂 Theek karo use — aaj bhej do!`,
    (n,amt) => `${n}, ${amt} ne mujhe letter likha — "Rescue karo, bahut din ho gaye" 😂 Rescue mission aaj!`,
    (n,amt) => `${n} bhai, ${amt} ne rishta.com pe profile bana liya — "Looking for owner to take me home" 😂 Claim karo aaj!`,
    (n,amt) => `${n}, ${amt} Tinder pe hai — "Swiping right on anyone who will take me home" 😂 Match karo — bhej do!`,

    // 7. Desi Logic (6)
    (n,amt) => `${n} bhai, maa ne kaha — "Waqt pe paisa dena achha kaam hai" 😄 Maa ki baat maano — ${amt} aaj!`,
    (n,amt) => `${n}, "Dosti mein no please, no thank you" — but ${amt} mein please zaroor 😄 Aaj bhej do please!`,
    (n,amt) => `${n} bhai, tune hi kaha tha "Bhai tu bol, main karunga" 😄 Bol raha hun — ${amt} aaj bhej de!`,
    (n,amt) => `${n}, chai pi rahe hain — ${amt} bhi aa jaaye toh mazaa aur aa jaaye 😄 Aaj bhej do!`,
    (n,amt) => `${n} bhai, papa ne sikhaaya — "Udhaar jaldi wapas karo" 😊 Papa ki baat — ${amt} aaj!`,
    (n,amt) => `${n}, kitni baar bolunga — ${amt} bhej de yaar 😄 Ek baar mein samajh le!`,

    // 8. Festival (6)
    (n,amt) => `${n} bhai, Diwali hai — ghar ki safai ke saath ${amt} bhi clear karo 🪔 Lakshmi ji khush hongi!`,
    (n,amt) => `${n}, naya saal aa raha hai — ${amt} ke saath fresh start karte hain 🎉 Purana hisaab clear!`,
    (n,amt) => `${n} bhai, Holi pe rang lagao, ${amt} bhi lagao — sab rangeen ho jaayega 🌈 Aaj bhej do!`,
    (n,amt) => `${n}, monsoon mein paisa bhi bahna chahiye — tere account se mere account ki taraf ☔ ${amt} aaj!`,
    (n,amt) => `${n} bhai, garmi mein ${amt} bhej do — AC on karo, transfer karo — dono ko thanda lagega 😅`,
    (n,amt) => `${n}, Raksha Bandhan pe behen ne rakhi bandhi — bhai ne ${amt} wapas kiya 😄 Tradition nibhao!`,
  ],

  Bhojpuri: [
    // Sapne wala (4)
    (n,amt) => `${n} bhaiya, hamaar ${amt} roj sapna mein aawela aur kahe "Ghar bhej da!" 😂 Aaj bhej da please!`,
    (n,amt) => `${n} bhai, ${amt} tohar ghar ke permanent resident ban gaili ba 😅 Kiraya bhi maangi ab. Pehle bhej da!`,
    (n,amt) => `${n} bhaiya, hamaar ${amt} tohar jagah ka weather forecast dekh rahi ba — "Permanently settled" 😂 Kab shift hoi?`,
    (n,amt) => `${n} bhai, ${amt} ne sad status lagail ba — "Missing my malik since forever" 😭 Ghar bhej da aaj!`,

    // Tech (3)
    (n,amt) => `${n} bhaiya, ${amt} ke GPS on ba — GPS kahe ba "Still at ${n}'s location" 😂 Transfer kar da!`,
    (n,amt) => `${n} bhai, Google Pay ne ${amt} ke liye "Pending Since Forever" ka badge de dihis 😂 Aaj clear kar da!`,
    (n,amt) => `${n} bhaiya, ${amt} tohar phone mein app ki tarah install ho gaili ba permanently 😅 Uninstall karo — bhej da!`,

    // Filmy (3)
    (n,amt) => `${n} bhaiya, "Picture abhi baaki ba" — aur wo picture ba ${amt} tohar account se hamaar account mein jaaye ke 🎬 Action!`,
    (n,amt) => `${n} bhai, "All izz well" tab hoi jab ${amt} aa jaai 😂 Aaj bhej da!`,
    (n,amt) => `${n} bhaiya, Nirhua bhi apna paisa waqt pe leta ha — tohar kab milega? 😄 ${amt} aaj bhej da!`,

    // Comparison (3)
    (n,amt) => `${n} bhaiya, IRCTC ke waiting confirm ho jaala, train time pe aawela — lekin tohar ${amt} kabhi nahi aail 😂`,
    (n,amt) => `${n} bhai, Amazon same day delivery deta ba, Zomato 30 min mein khana — tohar ${amt} kab aaii? 😂`,
    (n,amt) => `${n} bhaiya, baarish time pe aawela, exam date time pe aawela — tohar ${amt} kabhi nahi 😄`,

    // Savage (3)
    (n,amt) => `${n} bhaiya, ${amt} ke documentary banat ba — "Wo Paisa Jo Kabhi Nahi Aail" 🎬 Sequel mat banana — aaj bhej da!`,
    (n,amt) => `${n} bhai, ${amt} ek unsolved mystery ban gaili ba 🔍 Sherlock nahi chahiye — bas transfer kar da!`,
    (n,amt) => `${n} bhaiya, scientist log ${amt} ke extinct species maan rahe baa 😂 Prove kar da — aaj bhej ke!`,

    // Desi Logic (4)
    (n,amt) => `${n} bhaiya, "Dosti alag ba, hisaab alag ba" — hisaab clear kar da na 😄 ${amt} aaj bhej da!`,
    (n,amt) => `${n} bhai, maai kaheli — "Waqt pe paisa dena achha kaam ba" 😄 Maai ke baat maano — ${amt} aaj!`,
    (n,amt) => `${n} bhaiya, tohi kahelu — "Bhai tu bol, karb" 😄 Bol taat ba — ${amt} aaj bhej da!`,
    (n,amt) => `${n} bhai, chai pite pite ${amt} bhej da — kono mehnat nahi hoi 😊`,
  ],

  Hindi: [
    // Sapne wala (4)
    (n,amt) => `${n} ji, mera ${amt} aapke paas itne samay se hai ki woh ab wahan ka nagrik ban gaya hai 😂 Kripya deportation karein!`,
    (n,amt) => `${n} bhai, ${amt} ne mujhse baat karna band kar diya — "Jab tak tu mujhe wapas nahi laata" 😢 Aaj le aao!`,
    (n,amt) => `${n} ji, mera ${amt} roz subah uthke phone karta hai — "Kab ghar aaun?" 😄 Aaj bhej do!`,
    (n,amt) => `${n} bhai, ${amt} ne sad WhatsApp status lagaya — "Missing since forever" 😭 Ghar bhej do aaj!`,

    // Tech (3)
    (n,amt) => `${n} ji, ${amt} ka Google Maps mein location "At ${n}'s Place" dikh raha hai 📍😂 Redirect karein!`,
    (n,amt) => `${n} bhai, Google Pay ne ${amt} ke liye "Pending Since Forever" badge de diya 😂 Aaj clear karein!`,
    (n,amt) => `${n} ji, ${amt} tere phone mein app ki tarah permanently install ho gaya hai 😅 Uninstall karo — bhej do!`,

    // Filmy (3)
    (n,amt) => `${n} bhai, "Picture abhi baaki hai mere dost" 🎬 Aur wo picture hai ${amt} transfer hone ki. Action!`,
    (n,amt) => `${n} ji, "All izz well" tab hoga jab ${amt} aa jaaye 😂 Aaj transfer karein!`,
    (n,amt) => `${n} bhai, "Bade bade deshon mein chhoti chhoti baatein..." ${amt} wali chhoti baat aaj ho jaaye 😄`,

    // Comparison (3)
    (n,amt) => `${n} ji, IRCTC ki waiting list confirm hoti hai — lekin aapka ${amt} nahi aaya 😄 Aaj zaroor bhejein!`,
    (n,amt) => `${n} bhai, Amazon same-day delivery deta hai — sirf aapka ${amt} delivery pending hai 😂`,
    (n,amt) => `${n} ji, bijli ka bill aata hai, train time pe chalti hai — lekin ${amt} kabhi nahi aaya 😂`,

    // Savage (3)
    (n,amt) => `${n} bhai, ${amt} pe documentary bana sakta hun 😄 Happy ending chahiye — aaj bhej do!`,
    (n,amt) => `${n} ji, ${amt} ek unsolved mystery ban gayi hai 🔍 Aaj solve karein — transfer karein!`,
    (n,amt) => `${n} bhai, scientist log ${amt} ko extinct species maan rahe hain 😂 Prove karo — aaj bhej ke!`,

    // Desi Logic (4)
    (n,amt) => `${n} bhai, maa ne kaha tha — "Udhaar jaldi wapas karo" 😄 Maa ki baat maano — ${amt} aaj!`,
    (n,amt) => `${n} ji, "Dosti mein no please, no thank you" — but ${amt} mein please zaroor 😄 Aaj bhejein!`,
    (n,amt) => `${n} bhai, tune hi kaha tha "Bhai bol, main karunga" 😄 Bol raha hun — ${amt} aaj bhej de!`,
    (n,amt) => `${n} ji, chai pi rahe hain — ${amt} bhi aa jaaye toh mazaa aur ho jaaye 😄 Aaj bhejein!`,
  ],

  English: [
    // Sapne wala (4)
    (n,amt) => `${n} bro, my ${amt} has been living at your place so long it's started paying rent there 😂 Please evict it today!`,
    (n,amt) => `${n}, my ${amt} is officially homesick 😢 It keeps texting me "When can I go back?" Send it home today!`,
    (n,amt) => `${n} bro, my ${amt} filed a missing person report 😂 Help reunite us today please!`,
    (n,amt) => `${n}, my ${amt} is on Tinder — "Swiping right on anyone who'll take me home" 😂 Match made — transfer today!`,

    // Tech (3)
    (n,amt) => `${n}, I turned on GPS tracking for my ${amt} — still showing at your location 📍😂 Please redirect it!`,
    (n,amt) => `${n} bro, Google Pay gave my ${amt} a "Pending Since Forever" badge 😂 Clear it today!`,
    (n,amt) => `${n}, my ${amt} has been WhatsApp messaging me "Blue tick but no transfer" 😂 Today please!`,

    // Filmy (3)
    (n,amt) => `${n} bro, my ${amt} has gone viral — "The money that never came home" documentary dropping soon 🎬 Cancel it — transfer today!`,
    (n,amt) => `${n}, "All izz well" only happens when ${amt} arrives 😂 Make it happen today!`,
    (n,amt) => `${n} bro, picture abhi baaki hai — ${amt} transfer scene pending 🎬 Action please!`,

    // Comparison (3)
    (n,amt) => `${n}, Zomato delivers in 30 mins, Amazon in a day — when is my ${amt} arriving? 😂`,
    (n,amt) => `${n} bro, IRCTC waitlist confirms, trains run on time — only your ${amt} is missing 😄`,
    (n,amt) => `${n}, Netflix auto-renews, EMIs get cut — but your ${amt} needs manual effort? 😂`,

    // Savage (3)
    (n,amt) => `${n} bro, my ${amt} is an unsolved mystery 🔍 No Sherlock needed — just transfer!`,
    (n,amt) => `${n}, scientists classified my ${amt} as an extinct species 😂 Prove them wrong — send it today!`,
    (n,amt) => `${n} bro, ${amt} is in therapy now — abandonment issues 😂 Please heal it — send it home today!`,

    // Desi Logic (4)
    (n,amt) => `${n}, you said "bro just ask me anything" 😄 Asking — ${amt} please, today!`,
    (n,amt) => `${n} bro, friendship is different, accounts are different 😄 ${amt} today please!`,
    (n,amt) => `${n}, no drama, no pressure — just ${amt} today please 😊`,
    (n,amt) => `${n} bro, over chai let's also settle ${amt} 😄 Today?`,
  ],
};

/* ===========================================================
   MAIN GENERATE — picks random from pool every time
   =========================================================== */
function generateMessages({ name, amount, relation, language, tone, note }) {
  const n    = name && name.trim() ? name.trim() : 'Bhai';
  const amt  = fmtMoney(amount);
  const note_ = note && note.trim() ? note.trim() : '';
  const lang = language || 'Hinglish';

  let pool;
  let labelPrefix;

  if (tone === 'Funny') {
    pool        = FUNNY[lang] || FUNNY['Hinglish'];
    labelPrefix = ['😂 Funny', '😄 Mast Funny', '🤣 Ekdum Dhamaal'];
    const picks = pickN(pool, 3);
    return picks.map((fn, i) => ({
      label: labelPrefix[i] || '😂',
      text:  fn(n, amt),
    }));
  }

  if (tone === 'Polite') {
    pool        = POLITE[lang] || POLITE['Hinglish'];
    labelPrefix = '🙏 Polite';
  } else if (tone === 'Strong') {
    pool        = STRONG[lang] || STRONG['Hinglish'];
    labelPrefix = '💪 Strong';
  } else {
    // Friendly (default)
    pool        = FRIENDLY[lang] || FRIENDLY['Hinglish'];
    labelPrefix = '😊 Friendly';
  }

  // 3 unique picks
  const picks = pickN(pool, 3);
  return picks.map(fn => ({
    label: labelPrefix,
    text:  fn(n, amt, note_),
  }));
}
