/* ===========================================================
   BaatBanao Chat App v1.0.9
   Real-time 1-1 chat with Firebase
   =========================================================== */

(function(){
  'use strict';

  let FB = null;
  let currentUser = null;
  let activeChat = null;
  let unsubMessages = null;
  let unsubTyping = null;
  let unsubChats = null;
  let typingTimeout = null;

  const CHAT_STATE = {
    user: null,           // {uid, displayName, connectCode}
    chats: [],            // list of active chats
    currentChatId: null,
    messages: {},         // {chatId: [messages]}
    typing: {},           // {chatId: {userId: bool}}
    presence: {},         // {userId: {online, lastSeen}}
    ready: false
  };
  window.CHAT_STATE = CHAT_STATE;

  /* -------- Wait for Firebase -------- */
  window.addEventListener('bb-firebase-ready', () => {
    FB = window.BB_Firebase;
    initChat();
  });

  /* -------- Init: Sign in anonymously + setup user profile -------- */
  async function initChat(){
    try {
      const result = await FB.signInAnonymously(FB.auth);
      const uid = result.user.uid;

      // Load or create user profile
      const userRef = FB.doc(FB.db, 'users', uid);
      const snap = await FB.getDoc(userRef);

      let userData;
      if (snap.exists()) {
        userData = snap.data();
      } else {
        // New user — create profile
        const connectCode = generateConnectCode();
        userData = {
          uid,
          displayName: getStoredName() || 'Dost',
          connectCode,
          createdAt: FB.serverTimestamp(),
          lastSeen: FB.serverTimestamp()
        };
        await FB.setDoc(userRef, userData);
      }

      currentUser = userData;
      currentUser.uid = uid;
      CHAT_STATE.user = currentUser;
      CHAT_STATE.ready = true;

      // Setup online presence
      setupPresence(uid);

      // Listen for user's chats
      subscribeChats();

      // Notify UI
      window.dispatchEvent(new CustomEvent('bb-chat-ready', { detail: currentUser }));
      console.log('[BB Chat] Ready as', currentUser.displayName, uid.slice(0,8));

      // If URL has connect code, auto-add
      handleConnectDeepLink();

    } catch(err) {
      console.error('[BB Chat] Init failed:', err);
      window.dispatchEvent(new CustomEvent('bb-chat-error', { detail: err.message }));
    }
  }

  /* -------- Connect Code (6-char shareable) -------- */
  function generateConnectCode(){
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusing chars
    let code = '';
    for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
  }

  function getStoredName(){
    try { return localStorage.getItem('bb_chat_name'); } catch(e){ return null; }
  }
  function setStoredName(name){
    try { localStorage.setItem('bb_chat_name', name); } catch(e){}
  }

  /* -------- Update display name -------- */
  async function updateDisplayName(name){
    if (!currentUser || !name.trim()) return;
    const userRef = FB.doc(FB.db, 'users', currentUser.uid);
    await FB.updateDoc(userRef, { displayName: name.trim() });
    currentUser.displayName = name.trim();
    setStoredName(name.trim());
    window.dispatchEvent(new CustomEvent('bb-chat-user-updated'));
  }

  /* -------- Presence (online/offline via Realtime DB) -------- */
  function setupPresence(uid){
    const presenceRef = FB.ref(FB.rtdb, `presence/${uid}`);
    const connRef = FB.ref(FB.rtdb, '.info/connected');

    FB.onValue(connRef, (snap) => {
      if (snap.val() === true) {
        FB.onDisconnect(presenceRef).set({
          online: false,
          lastSeen: FB.rtdbServerTimestamp()
        });
        FB.set(presenceRef, { online: true, lastSeen: FB.rtdbServerTimestamp() });
      }
    });
  }

  function subscribePresence(uid, callback){
    const presenceRef = FB.ref(FB.rtdb, `presence/${uid}`);
    return FB.onValue(presenceRef, (snap) => {
      const data = snap.val() || { online: false, lastSeen: 0 };
      CHAT_STATE.presence[uid] = data;
      callback && callback(data);
    });
  }

  /* -------- Chat List Subscription -------- */
  function subscribeChats(){
    if (unsubChats) unsubChats();
    // NOTE: intentionally NOT using orderBy('lastMessageAt') here.
    // array-contains + orderBy on a different field needs a Firestore
    // composite index (Console > Firestore > Indexes). To keep this
    // working out-of-the-box with zero manual Firebase Console setup,
    // we sort client-side instead (50 chats max, trivial cost).
    const q = FB.query(
      FB.collection(FB.db, 'chats'),
      FB.where('participants', 'array-contains', currentUser.uid),
      FB.limit(50)
    );
    unsubChats = FB.onSnapshot(q, (snapshot) => {
      const chats = [];
      snapshot.forEach(doc => {
        chats.push({ id: doc.id, ...doc.data() });
      });
      chats.sort((a, b) => {
        const ta = (a && a.lastMessageAt && a.lastMessageAt.toMillis) ? a.lastMessageAt.toMillis() : ((a && a.lastMessageAt && a.lastMessageAt.seconds) || 0) * 1000;
        const tb = (b && b.lastMessageAt && b.lastMessageAt.toMillis) ? b.lastMessageAt.toMillis() : ((b && b.lastMessageAt && b.lastMessageAt.seconds) || 0) * 1000;
        return tb - ta;
      });
      CHAT_STATE.chats = chats;
      CHAT_STATE.chatsError = null;
      window.dispatchEvent(new CustomEvent('bb-chats-updated'));
    }, (err) => {
      console.error('[BB Chat] Chats subscription failed:', err);
      CHAT_STATE.chatsError = err.message;
      // Let the UI know so it doesn't spin forever on a silent failure.
      window.dispatchEvent(new CustomEvent('bb-chats-updated'));
    });
  }

  /* -------- Find user by connect code -------- */
  async function findUserByCode(code){
    const q = FB.query(
      FB.collection(FB.db, 'users'),
      FB.where('connectCode', '==', code.toUpperCase()),
      FB.limit(1)
    );
    const snap = await FB.getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, ...doc.data() };
  }

  /* -------- Start / find 1-1 chat with user -------- */
  async function startChatWithUser(otherUser){
    if (otherUser.uid === currentUser.uid) {
      throw new Error('Aap khud se chat nahi kar sakte 😄');
    }
    // Deterministic chat ID (sorted UIDs)
    const chatId = [currentUser.uid, otherUser.uid].sort().join('_');
    const chatRef = FB.doc(FB.db, 'chats', chatId);
    const snap = await FB.getDoc(chatRef);

    if (!snap.exists()) {
      await FB.setDoc(chatRef, {
        participants: [currentUser.uid, otherUser.uid],
        participantNames: {
          [currentUser.uid]: currentUser.displayName,
          [otherUser.uid]: otherUser.displayName
        },
        createdAt: FB.serverTimestamp(),
        lastMessage: '',
        lastMessageAt: FB.serverTimestamp(),
        lastSenderId: null,
        unreadCount: { [currentUser.uid]: 0, [otherUser.uid]: 0 }
      });
    }
    return chatId;
  }

  /* -------- Connect via code -------- */
  async function connectViaCode(code){
    if (!code || code.length !== 6) {
      throw new Error('6-character code chahiye');
    }
    const otherUser = await findUserByCode(code);
    if (!otherUser) {
      throw new Error('Ye code kisi bhi user se match nahi kar raha 🤔');
    }
    const chatId = await startChatWithUser(otherUser);
    return { chatId, otherUser };
  }

  /* -------- Handle URL deep-link ?connect=CODE -------- */
  function handleConnectDeepLink(){
    const params = new URLSearchParams(location.search);
    const code = params.get('connect');
    if (code && code.length === 6) {
      connectViaCode(code)
        .then(({ chatId }) => {
          window.dispatchEvent(new CustomEvent('bb-chat-connected', { detail: { chatId }}));
          // Clean URL
          history.replaceState({}, '', location.pathname + location.hash);
        })
        .catch(err => {
          window.dispatchEvent(new CustomEvent('bb-chat-error', { detail: err.message }));
        });
    }
  }

  /* -------- Subscribe to messages in a chat -------- */
  function openChat(chatId){
    if (unsubMessages) unsubMessages();
    if (unsubTyping) unsubTyping();

    activeChat = chatId;
    CHAT_STATE.currentChatId = chatId;
    CHAT_STATE.messages[chatId] = CHAT_STATE.messages[chatId] || [];

    // Messages subscription
    const msgsRef = FB.collection(FB.db, 'chats', chatId, 'messages');
    const q = FB.query(msgsRef, FB.orderBy('createdAt', 'asc'), FB.limit(100));
    unsubMessages = FB.onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      CHAT_STATE.messages[chatId] = msgs;
      window.dispatchEvent(new CustomEvent('bb-messages-updated', { detail: { chatId, msgs }}));

      // Mark as read
      markChatAsRead(chatId);
    });

    // Typing subscription (Realtime DB)
    const typingRef = FB.ref(FB.rtdb, `typing/${chatId}`);
    unsubTyping = FB.onValue(typingRef, (snap) => {
      const data = snap.val() || {};
      CHAT_STATE.typing[chatId] = data;
      window.dispatchEvent(new CustomEvent('bb-typing-updated', { detail: { chatId, typing: data }}));
    });
  }

  function closeChat(){
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }
    if (unsubTyping) { unsubTyping(); unsubTyping = null; }
    activeChat = null;
    CHAT_STATE.currentChatId = null;
  }

  /* -------- Send message -------- */
  async function sendMessage(chatId, text){
    if (!text.trim()) return;
    if (text.length > 1000) throw new Error('Message too long (max 1000 chars)');

    const chatRef = FB.doc(FB.db, 'chats', chatId);
    const msgsRef = FB.collection(FB.db, 'chats', chatId, 'messages');

    // Get other participant
    const snap = await FB.getDoc(chatRef);
    const chat = snap.data();
    const otherUid = chat.participants.find(uid => uid !== currentUser.uid);

    // Add message
    await FB.addDoc(msgsRef, {
      text: text.trim(),
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      createdAt: FB.serverTimestamp(),
      readBy: [currentUser.uid],
      status: 'sent'
    });

    // Update chat metadata
    await FB.updateDoc(chatRef, {
      lastMessage: text.trim().slice(0, 100),
      lastMessageAt: FB.serverTimestamp(),
      lastSenderId: currentUser.uid,
      [`unreadCount.${otherUid}`]: FB.increment(1)
    });

    // Clear typing indicator
    setTyping(chatId, false);
  }

  /* -------- Mark chat as read (reset unread) -------- */
  async function markChatAsRead(chatId){
    if (!currentUser) return;
    try {
      const chatRef = FB.doc(FB.db, 'chats', chatId);
      await FB.updateDoc(chatRef, {
        [`unreadCount.${currentUser.uid}`]: 0
      });
      // Mark all messages as read by me
      const msgsRef = FB.collection(FB.db, 'chats', chatId, 'messages');
      const q = FB.query(msgsRef, FB.orderBy('createdAt', 'desc'), FB.limit(50));
      const snap = await FB.getDocs(q);
      const batch = FB.writeBatch(FB.db);
      snap.forEach(doc => {
        const data = doc.data();
        if (data.senderId !== currentUser.uid && !(data.readBy || []).includes(currentUser.uid)) {
          batch.update(doc.ref, {
            readBy: FB.arrayUnion(currentUser.uid),
            status: 'read'
          });
        }
      });
      await batch.commit();
    } catch(err) {
      console.warn('[BB Chat] Mark read failed:', err);
    }
  }

  /* -------- Typing indicator -------- */
  function setTyping(chatId, isTyping){
    if (!currentUser) return;
    const typingRef = FB.ref(FB.rtdb, `typing/${chatId}/${currentUser.uid}`);
    if (isTyping) {
      FB.set(typingRef, true);
      FB.onDisconnect(typingRef).set(false);
    } else {
      FB.set(typingRef, false);
    }
  }

  function notifyTyping(chatId){
    setTyping(chatId, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => setTyping(chatId, false), 3000);
  }

  /* -------- Delete chat -------- */
  async function deleteChat(chatId){
    // Just remove myself from participants view (soft delete)
    // For full delete, we'd need cloud function
    const chatRef = FB.doc(FB.db, 'chats', chatId);
    await FB.updateDoc(chatRef, {
      [`hiddenFor.${currentUser.uid}`]: true
    });
  }

  /* -------- Public API for chat-ui.js -------- */
  window.BB_Chat = {
    getState: () => CHAT_STATE,
    updateDisplayName,
    connectViaCode,
    startChatWithUser,
    openChat,
    closeChat,
    sendMessage,
    markChatAsRead,
    setTyping,
    notifyTyping,
    subscribePresence,
    deleteChat,
    generateShareLink: () => {
      if (!currentUser) return '';
      return `${location.origin}${location.pathname}?connect=${currentUser.connectCode}#chat`;
    }
  };

})();
