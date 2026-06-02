document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("dark");
  const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });

  const loginPage = document.getElementById("login-page");
  const chatPage = document.getElementById("chat-page");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const userListDiv = document.getElementById("user-list");
  const chatTitleEl = document.getElementById("chat-username");
  const chatStatusEl = document.getElementById("chat-status");
  const chatBox = document.getElementById("chat-box");
  const inputWrapper = document.getElementById("input-wrapper");
  const preBtn = document.getElementById("pre-btn");
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");
  const sendBtn = document.getElementById("send-btn");
  const themeBtn = document.getElementById("theme-btn");
  const sidebarBtn = document.getElementById("sidebar-btn");
  const sidebarEl = document.querySelector(".sidebar");
  const chatWindowEl = document.querySelector(".chat-window");

  const logoutBtn = document.createElement("button");
  logoutBtn.id = "logout-btn";
  logoutBtn.title = "Logout";
  logoutBtn.innerHTML = "<i class='bi bi-box-arrow-right'></i>";
  logoutBtn.style.marginLeft = "auto";
  logoutBtn.style.background = "transparent";
  logoutBtn.style.border = "0";
  logoutBtn.style.cursor = "pointer";
  const headerActions = document.querySelector(".header-actions");
  headerActions.appendChild(logoutBtn);
  const notificationBtn = document.createElement("button");
  notificationBtn.id = "notification-btn";
  notificationBtn.title = "Toggle Notifications";
  headerActions.appendChild(notificationBtn);

  let currentUser = "";
  let currentReceiver = "";
  let chats = {};
  let codeMode = false;
  let unreadCount = 0;
  let isWindowActive = document.hasFocus();
  let notificationsEnabled = localStorage.getItem("notificationsEnabled") !== "false";
  let typingTimer;
  let currentReply = null;
  const TYPING_TIMEOUT = 1500;
  const typingTimers = {};
  let onlineUsers = [];

  function updateTitleBadge() {
    unreadCount = 0;
    for (const user in chats) {
      unreadCount += chats[user].filter(m => m.type === "other" && !m.seen).length;
    }
    document.title = (unreadCount > 0 ? "(" + unreadCount + ") " : "") + "Chat App";
  }

  function markConversationSeen(user, shouldEmit) {
    if (!user || !chats[user]) return false;
    let hasUnseen = false;
    chats[user].forEach((m) => {
      if (m.type === "other" && !m.seen) {
        m.seen = true;
        hasUnseen = true;
      }
    });
    if (hasUnseen) {
      updateTitleBadge();
      if (shouldEmit) {
        socket.emit("messageSeen", { from: currentUser, to: user });
      }
    }
    return hasUnseen;
  }

  function getInputEl() { return document.getElementById("message-input"); }
  function getInputValue() { const el = getInputEl(); return el ? el.value : ""; }
  function setInputValue(v) { const el = getInputEl(); if (el) el.value = v; }
  function openSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.remove("collapsed");
    sidebarEl.classList.add("show");
  }
  function closeSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.add("collapsed");
    sidebarEl.classList.remove("show");
  }
  function toggleSidebar() {
    if (!sidebarEl) return;
    if (sidebarEl.classList.contains("collapsed")) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }
  function updateNotificationToggleUI() {
    notificationBtn.innerHTML = notificationsEnabled ? "<i class='bi bi-bell-fill'></i>" : "<i class='bi bi-bell-slash-fill'></i>";
    notificationBtn.title = notificationsEnabled ? "Notifications: On" : "Notifications: Off";
    notificationBtn.classList.toggle("off", !notificationsEnabled);
  }

  function updateHeader(user, online) {
    if (!user) {
      chatTitleEl.textContent = "Select a user";
      chatStatusEl.textContent = "Offline";
      return;
    }
    chatTitleEl.textContent = user;
    chatStatusEl.textContent = online ? "Online" : "Offline";
  }

  function clearReply() {
    currentReply = null;
    const preview = document.getElementById("reply-preview");
    if (preview) preview.remove();
  }

  function setReply(from, text) {
    currentReply = { from, text };
    let preview = document.getElementById("reply-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "reply-preview";
      preview.className = "reply-preview";
      const cancel = document.createElement("span");
      cancel.className = "reply-cancel";
      cancel.textContent = "✖";
      cancel.title = "Cancel reply";
      cancel.addEventListener("click", clearReply);
      preview.appendChild(cancel);
      const span = document.createElement("span");
      span.id = "reply-text";
      preview.appendChild(span);
      const wrapper = document.querySelector(".chat-input");
      wrapper.parentNode.insertBefore(preview, wrapper);
    }
    document.getElementById("reply-text").textContent = "Reply to " + from + ": " + text;
  }

  function showContextMenu(x, y, msg, from) {
    const existing = document.querySelector(".context-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.top = y + "px";
    menu.style.left = x + "px";

    const copyItem = document.createElement("div");
    copyItem.className = "context-menu-item";
    copyItem.textContent = "Copy";
    copyItem.addEventListener("click", () => {
      navigator.clipboard.writeText(msg).then(() => menu.remove());
    });

    const replyItem = document.createElement("div");
    replyItem.className = "context-menu-item";
    replyItem.textContent = "Reply";
    replyItem.addEventListener("click", () => {
      setReply(from, msg);
      menu.remove();
    });

    menu.appendChild(copyItem);
    menu.appendChild(replyItem);
    document.body.appendChild(menu);

    const hide = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", hide);
      }
    };
    setTimeout(() => document.addEventListener("click", hide), 0);
  }

  function addMessage(msg, type, code, from, seen, file, timestamp, reply) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message", type);

    let isText = false;
    if (file) {
      if (file.type && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = file.data;
        img.classList.add("shared-image");
        if (msg) {
          const caption = document.createElement("div");
          caption.textContent = msg;
          wrapper.appendChild(caption);
        }
        wrapper.appendChild(img);
      } else {
        const link = document.createElement("a");
        link.href = file.data;
        link.download = file.name || "download";
        link.textContent = "📎 " + (file.name || "Download File");
        link.classList.add("shared-file");
        wrapper.appendChild(link);
      }
    } else if (code) {
      wrapper.classList.add("code-block");
      const pre = document.createElement("pre");
      const codeTag = document.createElement("code");
      codeTag.textContent = msg;
      pre.appendChild(codeTag);
      wrapper.appendChild(pre);
      const timeSpan = document.createElement("span");
      timeSpan.classList.add("timestamp");
      timeSpan.textContent = timestamp || "";
      wrapper.appendChild(timeSpan);
      isText = true;
    } else {
      const textDiv = document.createElement("div");
      textDiv.classList.add("text-message");
      textDiv.textContent = msg;
      const timeSpan = document.createElement("span");
      timeSpan.classList.add("timestamp");
      timeSpan.textContent = timestamp || "";
      wrapper.appendChild(textDiv);
      wrapper.appendChild(timeSpan);
      isText = true;
    }

    if (reply) {
      const replyDiv = document.createElement("div");
      replyDiv.className = "reply-box";
      replyDiv.textContent = "↩ " + (reply.from || "") + ": " + (reply.text || "");
      wrapper.insertBefore(replyDiv, wrapper.firstChild);
    }

    if (isText || code) {
      wrapper.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, msg, from);
      });
    }

    if (type === "me") {
      const ticks = document.createElement("span");
      ticks.classList.add("ticks");
      ticks.textContent = seen ? "✓✓" : "✓";
      wrapper.appendChild(ticks);
      if (seen) wrapper.classList.add("seen");
    }

    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function renderChat(user) {
    chatBox.innerHTML = "";
    const list = chats[user] || [];
    list.forEach(function(m) {
      addMessage(m.message, m.type, !!m.code, m.from, !!m.seen, m.file, m.timestamp, m.reply);
    });
  }

  function sendMessage() {
    const msg = getInputValue();
    if (!msg) return;
    if (!currentReceiver) { alert("Select a user to chat with"); return; }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const payload = { from: currentUser, to: currentReceiver, message: msg, code: !!codeMode, timestamp: timestamp };
    if (currentReply) {
      payload.reply = currentReply;
    }
    socket.emit("chatMessage", payload);

    if (!chats[currentReceiver]) chats[currentReceiver] = [];
    chats[currentReceiver].push({ from: currentUser, message: msg, type: "me", code: !!codeMode, seen: false, timestamp: timestamp, reply: currentReply });
    renderChat(currentReceiver);
    setInputValue("");
    clearReply();
  }

  // --- Login ---
  const loginError = document.createElement("div");
  loginError.style.marginTop = "8px";
  loginForm.appendChild(loginError);

  if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  updateNotificationToggleUI();

  socket.on("connect", () => {
    const stored = localStorage.getItem("chatUsername");
    if (stored) {
      socket.emit("register", stored, (res) => {
        if (res && res.ok) {
          currentUser = res.username;
          loginPage.style.display = "none";
          chatPage.classList.remove("hidden");
          socket.emit("requestUserList");
        }
      });
    }
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const desired = usernameInput.value.trim();
    if (!desired) return;
    if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    socket.emit("register", desired, (res) => {
      if (!res || !res.ok) { loginError.textContent = (res && res.error) || "Login failed"; return; }
      currentUser = res.username;
      loginError.textContent = "";
      localStorage.setItem("chatUsername", desired);
      loginPage.style.display = "none";
      chatPage.classList.remove("hidden");
      socket.emit("requestUserList");
      unreadCount = 0;
      updateTitleBadge();
    });
  });

  // --- Logout ---
  logoutBtn.addEventListener("click", () => {
    currentUser = "";
    loginPage.style.display = "block";
    chatPage.classList.add("hidden");
    socket.disconnect();
    socket.connect();
    chats = {};
    chatBox.innerHTML = "";
    localStorage.clear();
    unreadCount = 0;
    updateTitleBadge();
    location.reload();
  });

  // --- UI event listeners ---
  sidebarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  userListDiv.addEventListener("click", () => {
    closeSidebar();
  });
  chatWindowEl.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
  notificationBtn.addEventListener("click", () => {
    notificationsEnabled = !notificationsEnabled;
    localStorage.setItem("notificationsEnabled", String(notificationsEnabled));
    updateNotificationToggleUI();
    if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  });

  themeBtn.addEventListener("click", () => document.body.classList.toggle("dark"));

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isWindowActive && currentReceiver) {
      markConversationSeen(currentReceiver, true);
    }
  });

  window.addEventListener("focus", () => {
    isWindowActive = true;
    if (!document.hidden && currentReceiver) {
      markConversationSeen(currentReceiver, true);
      renderChat(currentReceiver);
    }
  });

  window.addEventListener("blur", () => {
    isWindowActive = false;
  });

  sendBtn.addEventListener("click", sendMessage);

  attachBtn.addEventListener("click", () => {
    if (!currentReceiver) { alert("Select a user to share files with"); return; }
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File is too large (max 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const fileData = { name: file.name, type: file.type, data: evt.target.result };
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: "", code: false, file: fileData, timestamp: timestamp });
      if (!chats[currentReceiver]) chats[currentReceiver] = [];
      chats[currentReceiver].push({ from: currentUser, message: "", type: "me", code: false, seen: false, file: fileData, timestamp: timestamp });
      renderChat(currentReceiver);
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  inputWrapper.addEventListener("keydown", (e) => {
    const el = getInputEl();
    if (!el) return;
    if (el.tagName.toLowerCase() === "input" && e.key === "Enter") { e.preventDefault(); sendMessage(); }
  });

  preBtn.addEventListener("click", () => {
    codeMode = !codeMode;
    preBtn.classList.toggle("active", codeMode);
    const cur = getInputValue();
    inputWrapper.innerHTML = "";
    if (codeMode) {
      const ta = document.createElement("textarea");
      ta.id = "message-input"; ta.placeholder = "Paste or type code here..."; ta.rows = 6;
      ta.value = cur; inputWrapper.appendChild(ta);
    } else {
      const inp = document.createElement("input");
      inp.type = "text"; inp.id = "message-input"; inp.placeholder = "Type a message...";
      inp.value = cur; inputWrapper.appendChild(inp);
    }
    getInputEl().focus();
  });

  inputWrapper.addEventListener("input", (e) => {
    const el = e.target;
    if (!el || el.id !== "message-input") return;
    if (!currentReceiver) return;
    socket.emit("typing", { from: currentUser, to: currentReceiver, isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit("typing", { from: currentUser, to: currentReceiver, isTyping: false });
    }, TYPING_TIMEOUT);
  });

  // --- Socket event listeners ---
  socket.on("chatMessage", (data) => {
    var from = data.from, message = data.message, code = data.code, file = data.file, timestamp = data.timestamp, reply = data.reply;
    if (!chats[from]) chats[from] = [];
    chats[from].push({ from: from, message: message, type: "other", code: !!code, seen: false, file: file, timestamp: timestamp, reply: reply });

    if (currentReceiver === from) {
      if (!document.hidden && isWindowActive) {
        markConversationSeen(from, true);
      }
      renderChat(from);
    }
    
    updateTitleBadge();
    
    if (notificationsEnabled && (document.hidden || !isWindowActive) && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("New message from " + from, { body: message || "File attachment" });
    }
  });

  socket.on("messageSeen", (data) => {
    var from = data.from;
    if (!chats[from]) return;
    chats[from].forEach(function(m) { if (m.type === "me") m.seen = true; });
    if (currentReceiver === from) renderChat(from);
  });

  socket.on("typing", (data) => {
    var from = data.from, isTyping = data.isTyping;
    if (currentReceiver !== from) return;
    if (isTyping) {
      chatStatusEl.textContent = "Typing...";
      clearTimeout(typingTimers[from]);
      typingTimers[from] = setTimeout(() => { chatStatusEl.textContent = "Online"; }, 3000);
    } else {
      chatStatusEl.textContent = "Online";
      clearTimeout(typingTimers[from]);
    }
  });

  socket.on("userList", (users) => {
    onlineUsers = users.slice();
    userListDiv.innerHTML = "";
    users.forEach(function(user) {
      if (user === currentUser) return;
      const btn = document.createElement("button");
      btn.textContent = user;
      if (user === currentReceiver) btn.classList.add("active");
      btn.addEventListener("click", () => {
        currentReceiver = user;
        document.querySelectorAll("#user-list button").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        updateHeader(user, onlineUsers.includes(user));
        
        markConversationSeen(user, true);
        renderChat(user);
        updateTitleBadge();
        closeSidebar();
      });
      userListDiv.appendChild(btn);
    });
    updateHeader(currentReceiver, onlineUsers.includes(currentReceiver));
  });
});