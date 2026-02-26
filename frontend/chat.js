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
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");
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

  sidebarBtn.addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("show");
  });
  userListDiv.addEventListener("click", () => {
    document.querySelector(".sidebar").classList.remove("show");
  });

  function getInputEl() { return document.getElementById("message-input"); }
  function getInputValue() { const el = getInputEl(); return el ? el.value : ""; }
  function setInputValue(v) { const el = getInputEl(); if (el) el.value = v; }

  function updateHeader(user, online) {
    if (!user) {
      chatTitleEl.textContent = "Select a user";
      chatStatusEl.textContent = "Offline";
      return;
    }
    chatTitleEl.textContent = user;
    chatStatusEl.textContent = online ? "Online" : "Offline";
  }

  function addMessage(msg, type, code = false, from = "", seen = false, file = null) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message", type);

    let isText = false;
    if (file) {
      if (file.type && file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = file.data;
        img.classList.add("shared-image");
        if (msg) { // Optional caption
          const caption = document.createElement("div");
          caption.textContent = msg;
          wrapper.appendChild(caption);
        }
        wrapper.appendChild(img);
      } else {
        const link = document.createElement("a");
        link.href = file.data;
        link.download = file.name || "download";
        link.textContent = `📎 ${file.name || "Download File"}`;
        link.classList.add("shared-file");
        wrapper.appendChild(link);
      }
    } else if (code) {
      wrapper.classList.add("code-block");
      const label = document.createElement("div");
      label.classList.add("code-label"); // Added for styling
      label.textContent = from + ":";
      const pre = document.createElement("pre");
      const codeTag = document.createElement("code");
      codeTag.textContent = msg;
      pre.appendChild(codeTag);
      wrapper.appendChild(label);
      wrapper.appendChild(pre);
      try { if (window.hljs?.highlightElement) hljs.highlightElement(codeTag); } catch (e) { }
    } else {
      wrapper.textContent = from + ": " + msg;
      isText = true;
    }

    if (isText || code) {
      const copyBtn = document.createElement("i");
      copyBtn.classList.add("bi", "bi-clipboard", "copy-btn");
      copyBtn.title = "Copy text";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(msg).then(() => {
          copyBtn.classList.replace("bi-clipboard", "bi-check2");
          setTimeout(() => copyBtn.classList.replace("bi-check2", "bi-clipboard"), 2000);
        });
      });

      if (code) {
        // Append to the header label for code blocks
        const labelDiv = wrapper.querySelector(".code-label");
        if (labelDiv) labelDiv.appendChild(copyBtn);
      } else {
        wrapper.appendChild(copyBtn);
      }
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
    list.forEach(m => addMessage(m.message, m.type, !!m.code, m.from, !!m.seen, m.file));
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

  attachBtn?.addEventListener("click", () => {
    if (!currentReceiver) { alert("Select a user to share files with"); return; }
    fileInput.click();
  });

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const fileData = {
        name: file.name,
        type: file.type,
        data: evt.target.result // Base64 representation
      };

      socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: "", code: false, file: fileData });

      if (!chats[currentReceiver]) chats[currentReceiver] = [];
      chats[currentReceiver].push({ from: currentUser, message: "", type: "me", code: false, seen: false, file: fileData });
      renderChat(currentReceiver);
    };
    reader.readAsDataURL(file);
    fileInput.value = ""; // Reset input
  });
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

  socket.on("chatMessage", ({ from, message, code, file }) => {
    if (!chats[from]) chats[from] = [];
    chats[from].push({ from, message, type: "other", code: !!code, seen: false, file });

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

  socket.on("connect", () => { });
});
