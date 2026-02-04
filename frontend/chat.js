document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

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
  const sendBtn = document.getElementById("send-btn");
  const themeBtn = document.getElementById("theme-btn");
  const sidebarBtn = document.getElementById("sidebar-btn");

  let currentUser = "";
  let currentReceiver = "";
  let chats = {}; // { username: [ {from, message, type, code, seen} ] }
  let codeMode = false;
  let typingTimer = null;
  const TYPING_TIMEOUT = 1500;
  const typingTimers = {}; // per-user typing timeout
  let onlineUsers = [];

  function getInputEl() { return document.getElementById("message-input"); }
  function getInputValue() { const el = getInputEl(); return el ? el.value : ""; }
  function setInputValue(v) { const el = getInputEl(); if (el) el.value = v; }

  document.getElementById("sidebar-btn")
  .addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("show");
  });


  function updateHeader(user, online) {
    if (!user) {
      chatTitleEl.textContent = "Select a user";
      chatStatusEl.textContent = "Offline";
      return;
    }
    chatTitleEl.textContent = user;
    chatStatusEl.textContent = online ? "Online" : "Offline";
  }

  function addMessage(msg, type, code = false, from = "", seen = false, extra = {}) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", type);

  // Label (sender name)
  const label = document.createElement("div");
  label.classList.add("msg-label");
  if (from) label.textContent = from + ":";
  if (from) wrapper.appendChild(label);

  if (code) {
    // Code block
    wrapper.classList.add("code-block");
    const pre = document.createElement("pre");
    const codeTag = document.createElement("code");
    codeTag.textContent = msg;
    pre.appendChild(codeTag);
    wrapper.appendChild(pre);
    try { if (window.hljs?.highlightElement) hljs.highlightElement(codeTag); } catch (e) {}
  } 
  else if (extra.progress) {
    // Progress bubble
    wrapper.dataset.id = extra.id;
    wrapper.innerHTML = `
      <div class="progress-circle"></div>
      <span>Uploading ${msg}...</span>
    `;
  } 
  else if (extra.file) {
    // File message
    if (extra.fileType?.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = extra.fileData;
      img.alt = extra.fileName;
      img.classList.add("chat-image");
      wrapper.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.href = extra.fileData;
      link.download = extra.fileName;
      link.textContent = "📎 " + extra.fileName;
      link.classList.add("file-bubble");
      wrapper.appendChild(link);
    }
  } 
  else {
    // Plain text
    const text = document.createElement("span");
    text.textContent = msg;
    wrapper.appendChild(text);
  }

  // Seen ticks for self messages
  if (type === "me" && !extra.progress) {
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
    list.forEach(m => addMessage(m.message, m.type, !!m.code, m.from, !!m.seen));
  }

  function sendMessage() {
    const msg = getInputValue();
    if (!msg) return;
    if (!currentReceiver) { alert("Select a user to chat with"); return; }

    socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: msg, code: !!codeMode });

    if (!chats[currentReceiver]) chats[currentReceiver] = [];
    chats[currentReceiver].push({ from: currentUser, message: msg, type: "me", code: !!codeMode, seen: false });
    renderChat(currentReceiver);
    setInputValue("");
    // after sending, consider remote will emit messageSeen when they view; nothing else here
  }

  sendBtn?.addEventListener("click", sendMessage);
  inputWrapper.addEventListener("keydown", (e) => {
    const el = getInputEl();
    if (!el) return;
    if (el.tagName.toLowerCase() === "input" && e.key === "Enter") { e.preventDefault(); sendMessage(); }
  });

  preBtn?.addEventListener("click", () => {
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
    getInputEl()?.focus();
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

  themeBtn?.addEventListener("click", () => document.body.classList.toggle("dark"));
  sidebarBtn?.addEventListener("click", () => {
    const sb = document.querySelector(".sidebar");
    if (sb) sb.classList.toggle("collapsed");
  });

  socket.on("chatMessage", ({ from, message, code }) => {
    if (!chats[from]) chats[from] = [];
    chats[from].push({ from, message, type: "other", code: !!code, seen: false });

    if (currentReceiver === from) {
      renderChat(from);
      socket.emit("messageSeen", { from: currentUser, to: from });
    } else {
      // optional unread marker could be added here
    }
  });

  socket.on("messageSeen", ({ from }) => {
    if (!chats[from]) return;
    chats[from].forEach(m => { if (m.type === "me") m.seen = true; });
    if (currentReceiver === from) renderChat(from);
  });

  socket.on("typing", ({ from, isTyping }) => {
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
    users.forEach(user => {
      if (user === currentUser) return;
      const btn = document.createElement("button");
      btn.textContent = user;
      if (user === currentReceiver) btn.classList.add("active");
      btn.addEventListener("click", () => {
        currentReceiver = user;
        document.querySelectorAll("#user-list button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        updateHeader(user, onlineUsers.includes(user));
        renderChat(user);
        socket.emit("messageSeen", { from: currentUser, to: user });
      });
      userListDiv.appendChild(btn);
    });
    updateHeader(currentReceiver, onlineUsers.includes(currentReceiver));
  });

  const loginError = document.createElement("div");
  loginError.style.color = "crimson";
  loginError.style.marginTop = "8px";
  loginForm.appendChild(loginError);

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const desired = usernameInput.value.trim();
    if (!desired) return;
    socket.emit("register", desired, (res) => {
      if (!res?.ok) { loginError.textContent = res?.error || "Login failed"; return; }
      currentUser = res.username;
      loginError.textContent = "";
      loginPage.style.display = "none";
      chatPage.classList.remove("hidden");
      socket.emit("requestUserList");
    });
  });

  const fileBtn = document.getElementById("file-btn");
  const fileInput = document.getElementById("file-input");

  fileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const tempId = Date.now(); // unique ID for progress placeholder

    // show progress placeholder
    addMessage(`Uploading ${file.name}...`, "file-progress", null, currentUser, tempId);

    const reader = new FileReader();
    reader.onloadstart = () => updateProgress(tempId, 0);
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        updateProgress(tempId, percent);
      }
    };
    reader.onload = () => {
      socket.emit("fileMessage", {
        to: currentReceiver,
        from: currentUser,
        fileName: file.name,
        fileType: file.type,
        fileData: reader.result
      });
      // remove progress when done (real message comes from socket)
      removeMessage(tempId);
    };
    reader.readAsDataURL(file);

    fileInput.value = "";
  });

  function updateProgress(id, percent) {
    const el = document.querySelector(`[data-id="${id}"] .progress-circle`);
    if (el) el.style.background = `conic-gradient(#4caf50 ${percent * 3.6}deg, #ccc 0deg)`;
  }

  function removeMessage(id) {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
  }


  socket.on("fileMessage", ({ from, fileName, fileType, fileData }) => {
    const div = document.createElement("div");
    div.classList.add("message", from === currentUser ? "me" : "other");

    if (fileType.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = fileData;
      img.alt = fileName;
      img.classList.add("preview");

      img.addEventListener("click", () => {
        document.querySelector("#lightbox img").src = fileData;
        document.getElementById("lightbox").style.display = "flex";
      });

      div.appendChild(img);
    } else {
      const a = document.createElement("a");
      a.href = fileData;
      a.download = fileName;
      a.classList.add("file-bubble");
      a.innerHTML = `<i class="bi bi-paperclip"></i> ${fileName}`;
      div.appendChild(a);
    }

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  document.getElementById("lightbox").addEventListener("click", () => {
    document.getElementById("lightbox").style.display = "none";
    document.querySelector("#lightbox img").src = "";
  });


  socket.on("connect", () => { });
});