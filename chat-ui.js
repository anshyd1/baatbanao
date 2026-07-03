/* ===========================================================
   BaatBanao Chat UI v1.0.9
   Views: Chat list, Chat window, Connect screen
   =========================================================== */

(function(){
  'use strict';

  let currentView = null; // 'list' | 'chat' | 'connect' | 'setup'
  let currentChatData = null;

  // BUGFIX: chat used native alert() popups for every validation/error
  // message ("Naam to daalo bhai", "Missing or insufficient permissions",
  // etc). These block the whole page and look completely out of place
  // next to the app's own toast system. Route everything through the
  // same toast used by the rest of the app instead.
  function bbToast(msg){
    if (typeof window.showToast === 'function') window.showToast(msg);
    else console.warn('[BB Chat]', msg);
  }

  /* Wait for chat ready before mounting */
  window.addEventListener('bb-chat-ready', (e) => {
    const user = e.detail;
    // If no name set, show setup
    if (!user.displayName || user.displayName === 'Dost') {
      // Show setup only first time
      const wasSetup = localStorage.getItem('bb_chat_setup_done');
      if (!wasSetup && location.hash === '#chat') {
        renderChatView('setup');
        return;
      }
    }
    // BUGFIX: returning users (name already set) were stuck forever on the
    // "Chat connect ho raha hai..." loader — nothing re-rendered the view
    // once chat became ready, unless the chats subscription happened to
    // fire first. Force a re-render of whatever view is currently mounted.
    if ((location.hash === '#chat' || location.hash === '#connect') && currentView) {
      renderChatView(currentView);
    }
  });

  /* Safety net: if chat init hangs (slow/broken network) for too long,
     stop the infinite spinner and show a retry option instead of leaving
     the user staring at a loading mascot forever. */
  let chatReadyTimeout = setTimeout(() => {
    const state = window.CHAT_STATE || {};
    if (!state.ready && (location.hash === '#chat' || location.hash === '#connect')) {
      const container = document.getElementById('content');
      if (container) {
        container.innerHTML = `
          <div class="chat-loading">
            <img src="assets/mascot-sleeping.webp" alt="" width="120" height="120" loading="eager"/>
            <p>Connect hone mein time lag raha hai 😕</p>
            <button class="primary-btn" style="margin-top:14px;" onclick="location.reload()">Dobara try karo</button>
          </div>`;
      }
    }
  }, 12000);
  window.addEventListener('bb-chat-ready', () => clearTimeout(chatReadyTimeout));
  window.addEventListener('bb-chat-error', () => clearTimeout(chatReadyTimeout));

  window.addEventListener('bb-chat-error', (e) => {
    if (typeof window.showToast === 'function') {
      window.showToast('❌ ' + e.detail);
    }
  });

  window.addEventListener('bb-chat-connected', (e) => {
    if (typeof window.showToast === 'function') {
      window.showToast('🎉 Connect ho gaya! Chat kholte hain...');
    }
    setTimeout(() => openChatById(e.detail.chatId), 400);
  });

  window.addEventListener('bb-chats-updated', () => {
    if (currentView === 'list') renderChatList();
  });

  window.addEventListener('bb-messages-updated', (e) => {
    if (currentView === 'chat' && currentChatData && e.detail.chatId === currentChatData.id) {
      renderMessages(e.detail.msgs);
    }
  });

  window.addEventListener('bb-typing-updated', (e) => {
    if (currentView === 'chat' && currentChatData && e.detail.chatId === currentChatData.id) {
      renderTyping(e.detail.typing);
    }
  });

  /* -------- Main Render Function (called by app.js router) -------- */
  window.renderChatView = function(view){
    currentView = view || 'list';
    const container = document.getElementById('content');
    if (!container) return;
    container.classList.remove('in-chat-window');

    const state = window.CHAT_STATE || {};
    if (!state.ready) {
      container.innerHTML = `
        <div class="chat-loading">
          <img src="assets/mascot-thinking.webp" alt="" width="120" height="120" loading="eager"/>
          <p>Chat connect ho raha hai...</p>
        </div>`;
      return;
    }

    // Setup name if first time
    if (currentView === 'setup') return renderSetup();
    if (currentView === 'connect') return renderConnect();
    if (currentView === 'chat' && currentChatData) return renderChatWindow();
    return renderChatList();
  };

  /* -------- Setup Screen: Ask for display name -------- */
  function renderSetup(){
    const container = document.getElementById('content');
    container.innerHTML = `
      <div class="chat-setup">
        <img src="assets/mascot-coin.webp" alt="" width="120" height="120"/>
        <h2>Chat me apna naam kya rakhoge?</h2>
        <p>Dost ko yehi naam dikhega. Kabhi bhi change kar sakte ho.</p>
        <input id="chatNameInput" type="text" placeholder="Ramesh, Priya, ya nickname..." maxlength="20" autofocus/>
        <button id="chatNameSave" class="primary-btn">Aage badho →</button>
      </div>`;
    setTimeout(() => {
      const inp = document.getElementById('chatNameInput');
      if (inp && inp.focus) inp.focus();
    }, 100);
    document.getElementById('chatNameSave').addEventListener('click', async () => {
      const name = document.getElementById('chatNameInput').value.trim();
      if (!name) return bbToast('Naam to daalo bhai');
      const btn = document.getElementById('chatNameSave');
      btn.disabled = true; btn.textContent = 'Save ho raha hai...';
      try {
        await window.BB_Chat.updateDisplayName(name);
        localStorage.setItem('bb_chat_setup_done', '1');
        window.location.hash = 'chat';
        renderChatView('list');
      } catch(err) {
        bbToast('❌ ' + err.message);
        btn.disabled = false; btn.textContent = 'Aage badho →';
      }
    });
    document.getElementById('chatNameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('chatNameSave').click();
    });
  }

  /* -------- Chat List (Home of chat) -------- */
  function renderChatList(){
    const container = document.getElementById('content');
    const state = window.CHAT_STATE;
    const user = state.user;
    const chats = (state.chats || []).filter(c => !(c.hiddenFor && c.hiddenFor[user.uid]));

    container.innerHTML = `
      <div class="page-header">
        <button class="back-btn" onclick="navigate('home')" aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1>Chat 💬</h1>
      </div>

      <div class="chat-me-card">
        <div class="chat-me-info">
          <div class="chat-avatar">${initials(user.displayName)}</div>
          <div>
            <b>${escapeHtml(user.displayName)}</b>
            <p>Aapka code: <code class="connect-code">${user.connectCode}</code></p>
          </div>
        </div>
        <button class="chat-share-btn" onclick="shareChatCode()" aria-label="Share code">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
      </div>

      <button class="chat-new-btn" onclick="renderChatView('connect')">
        <span>➕</span> Naya dost add karo (code se)
      </button>

      ${state.chatsError ? `
        <div class="safety-banner" style="background:#FFE3E0; color:#B3261E; margin-top:10px;">
          ⚠️ Chats load nahi ho paye. <a href="#" onclick="event.preventDefault(); location.reload();" style="color:#B3261E; text-decoration:underline; font-weight:700;">Retry karo</a>
        </div>
      ` : ''}

      <div class="chat-list-title">Aapke chats</div>

      ${chats.length === 0 ? `
        <div class="empty-state">
          <img class="empty-mascot" src="assets/mascot-sleeping.webp" alt="" width="180" height="180" loading="lazy"/>
          <p><b>Abhi koi chat nahi hai</b><br>Apna code dost ko share karo ya unka code daalo!</p>
        </div>
      ` : chats.map(c => renderChatListItem(c, user.uid)).join('')}
    `;
  }

  function renderChatListItem(chat, myUid){
    const otherUid = chat.participants.find(uid => uid !== myUid);
    const otherName = (chat.participantNames || {})[otherUid] || 'Dost';
    const unread = (chat.unreadCount || {})[myUid] || 0;
    const preview = chat.lastMessage || 'Kuch bolna hai?';
    const time = chat.lastMessageAt ? formatChatTime(chat.lastMessageAt.toDate()) : '';
    const isMine = chat.lastSenderId === myUid;
    return `
      <div class="chat-list-item" onclick="openChatById('${chat.id}')">
        <div class="chat-avatar">${initials(otherName)}</div>
        <div class="chat-list-info">
          <div class="chat-list-top">
            <b>${escapeHtml(otherName)}</b>
            <span class="chat-list-time">${time}</span>
          </div>
          <div class="chat-list-bottom">
            <span class="chat-list-preview">${isMine ? '<span class="preview-you">You: </span>' : ''}${escapeHtml(preview)}</span>
            ${unread > 0 ? `<span class="chat-unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  /* -------- Connect Screen -------- */
  function renderConnect(){
    const container = document.getElementById('content');
    const user = window.CHAT_STATE.user;
    container.innerHTML = `
      <div class="page-header">
        <button class="back-btn" onclick="renderChatView('list')" aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1>Dost Add Karo</h1>
      </div>

      <div class="connect-card">
        <div class="connect-label">Aapka connect code</div>
        <div class="connect-code-big">${user.connectCode}</div>
        <button class="primary-btn" onclick="shareChatCode()">📲 WhatsApp pe share karo</button>
        <p class="connect-hint">Dost ko apna code do, ya unka code neeche daalo</p>
      </div>

      <div class="connect-input-wrap">
        <div class="connect-label">Dost ka 6-character code</div>
        <input id="connectCodeInput" type="text" placeholder="ABC123" maxlength="6" autocapitalize="characters" style="text-transform:uppercase; letter-spacing:6px; text-align:center; font-size:22px; font-weight:900;"/>
        <button class="primary-btn" id="connectSubmit">Chat shuru karo 💬</button>
      </div>
    `;
    const input = document.getElementById('connectCodeInput');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
    document.getElementById('connectSubmit').addEventListener('click', async () => {
      const code = input.value.trim().toUpperCase();
      if (code.length !== 6) return bbToast('6 characters ka code chahiye');
      const btn = document.getElementById('connectSubmit');
      btn.disabled = true; btn.textContent = 'Connect ho raha hai...';
      try {
        const { chatId } = await window.BB_Chat.connectViaCode(code);
        openChatById(chatId);
      } catch(err) {
        bbToast('❌ ' + err.message);
        btn.disabled = false; btn.textContent = 'Chat shuru karo 💬';
      }
    });
  }

  /* -------- Open a specific chat -------- */
  window.openChatById = function(chatId){
    const state = window.CHAT_STATE;
    let chat = state.chats.find(c => c.id === chatId);
    if (!chat) {
      // Wait for it
      setTimeout(() => openChatById(chatId), 500);
      return;
    }
    currentChatData = chat;
    currentView = 'chat';
    window.BB_Chat.openChat(chatId);
    renderChatWindow();
  };

  /* -------- Chat Window (message view) -------- */
  function renderChatWindow(){
    const container = document.getElementById('content');
    if (container) container.classList.add('in-chat-window');
    const state = window.CHAT_STATE;
    const user = state.user;
    const chat = currentChatData;
    const otherUid = chat.participants.find(uid => uid !== user.uid);
    const otherName = (chat.participantNames || {})[otherUid] || 'Dost';

    container.innerHTML = `
      <div class="chat-window">
        <div class="chat-header">
          <button class="back-btn" onclick="backToChatList()" aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div class="chat-avatar sm">${initials(otherName)}</div>
          <div class="chat-header-info">
            <b>${escapeHtml(otherName)}</b>
            <span class="chat-status" id="chatPresenceStatus">Online</span>
          </div>
          <button class="chat-header-menu" onclick="chatMenuAction()" aria-label="Menu">⋯</button>
        </div>

        <div class="chat-messages" id="chatMessages">
          <div class="chat-loading-small">Load ho raha hai...</div>
        </div>

        <div class="chat-typing-row" id="chatTypingRow" style="display:none;">
          <span class="typing-dots"><span></span><span></span><span></span></span>
          <span id="typingText">typing...</span>
        </div>

        <div class="chat-input-row">
          <textarea id="chatInputBox" placeholder="Message likho..." rows="1" maxlength="1000"></textarea>
          <button class="chat-send-btn" id="chatSendBtn" aria-label="Send">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;

    // Setup input handlers
    const input = document.getElementById('chatInputBox');
    const sendBtn = document.getElementById('chatSendBtn');

    input.addEventListener('input', () => {
      // Auto resize
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      // Notify typing
      if (input.value.trim()) {
        window.BB_Chat.notifyTyping(chat.id);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrent();
      }
    });

    sendBtn.addEventListener('click', sendCurrent);

    async function sendCurrent(){
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      try {
        await window.BB_Chat.sendMessage(chat.id, text);
      } catch(err) {
        bbToast('❌ ' + err.message);
      }
    }

    // Render existing messages
    const msgs = state.messages[chat.id] || [];
    renderMessages(msgs);

    // Subscribe to other user's presence
    window.BB_Chat.subscribePresence(otherUid, (presence) => {
      const el = document.getElementById('chatPresenceStatus');
      if (!el) return;
      if (presence.online) {
        el.textContent = '🟢 Online';
        el.className = 'chat-status online';
      } else {
        const ago = presence.lastSeen ? formatLastSeen(presence.lastSeen) : 'Offline';
        el.textContent = ago;
        el.className = 'chat-status';
      }
    });
  }

  window.backToChatList = function(){
    window.BB_Chat.closeChat();
    renderChatView('list');
  };

  window.chatMenuAction = function(){
    if (!currentChatData) return;
    if (confirm('Ye chat delete karna hai?')) {
      window.BB_Chat.deleteChat(currentChatData.id);
      backToChatList();
    }
  };

  /* -------- Render messages -------- */
  function renderMessages(msgs){
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const state = window.CHAT_STATE;
    const myUid = state.user.uid;

    if (!msgs.length) {
      container.innerHTML = `
        <div class="chat-empty-msg">
          <p>👋 Hi bolo — chat shuru karo!</p>
        </div>`;
      return;
    }

    let lastDate = '';
    const html = msgs.map(m => {
      const isMine = m.senderId === myUid;
      const isRead = m.readBy && m.readBy.length > 1;
      const time = m.createdAt ? formatMsgTime(m.createdAt.toDate()) : '';
      const date = m.createdAt ? formatDateSeparator(m.createdAt.toDate()) : '';
      let separator = '';
      if (date && date !== lastDate) {
        separator = `<div class="chat-date-separator"><span>${date}</span></div>`;
        lastDate = date;
      }
      return `
        ${separator}
        <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
          <div class="chat-bubble">
            <div class="chat-bubble-text">${escapeHtml(m.text)}</div>
            <div class="chat-bubble-meta">
              <span class="chat-time">${time}</span>
              ${isMine ? `<span class="chat-ticks ${isRead ? 'read' : ''}">✓✓</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  /* -------- Typing indicator -------- */
  function renderTyping(typingData){
    const row = document.getElementById('chatTypingRow');
    const text = document.getElementById('typingText');
    if (!row) return;
    const state = window.CHAT_STATE;
    const myUid = state.user.uid;
    const otherTyping = Object.keys(typingData).find(uid => uid !== myUid && typingData[uid] === true);
    if (otherTyping) {
      const chat = currentChatData;
      const name = (chat.participantNames || {})[otherTyping] || 'Dost';
      text.textContent = `${name} typing...`;
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  }

  /* -------- Share code via WhatsApp / native share -------- */
  window.shareChatCode = function(){
    const user = window.CHAT_STATE.user;
    const link = window.BB_Chat.generateShareLink();
    const message = `Hey! Mujhse BaatBanao pe chat karo 😄\n\nMera code: ${user.connectCode}\nYa direct link: ${link}\n\n(BaatBanao — free WhatsApp jaisi chat app, no login zaroori)`;
    if (navigator.share) {
      navigator.share({ title: 'BaatBanao Chat', text: message }).catch(()=>{});
    } else {
      const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(wa, '_blank');
    }
  };

  /* -------- Helpers -------- */
  function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function initials(name){
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0,2).map(w => (w && w[0] ? w[0].toUpperCase() : '') || '').join('');
  }

  function formatChatTime(d){
    if (!d) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit', hour12: true });
    }
    const diff = (now - d) / 86400000;
    if (diff < 2) return 'Kal';
    if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  function formatMsgTime(d){
    return d.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit', hour12: true });
  }

  function formatDateSeparator(d){
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return 'Aaj';
    const yest = new Date(now); yest.setDate(now.getDate()-1);
    if (d.toDateString() === yest.toDateString()) return 'Kal';
    const diff = (now - d) / 86400000;
    if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'long', year: diff > 300 ? 'numeric' : undefined });
  }

  function formatLastSeen(timestamp){
    const d = new Date(timestamp);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'Abhi';
    if (diffMin < 60) return `${diffMin} min pehle`;
    const diffHr = Math.floor(diffMin/60);
    if (diffHr < 24) return `${diffHr} ghante pehle`;
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

})();
