document.addEventListener("DOMContentLoaded", () => {
  // --- Toast Notification System with Live Progress Bar ---
  const toastContainer = document.getElementById("toast-container");

  function showToast(message, type = "info", duration = 4000) {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconClass = "bi-info-circle-fill";
    if (type === "error") iconClass = "bi-exclamation-octagon-fill";
    else if (type === "success") iconClass = "bi-check-circle-fill";

    toast.innerHTML = `
      <i class="bi ${iconClass}"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="Close">&times;</button>
      <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
    `;

    const closeBtn = toast.querySelector(".toast-close");
    const removeToast = () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px) scale(0.95)";
      setTimeout(() => toast.remove(), 250);
    };

    closeBtn.addEventListener("click", removeToast);
    toastContainer.appendChild(toast);

    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Socket Initialization ---
  let socket;
  try {
    socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
  } catch (err) {
    console.error("Socket.io init failed:", err);
    showToast("Failed to initialize connection library.", "error");
  }

  // --- DOM Elements ---
  const appLayout = document.getElementById("chat-page");
  const loginPage = document.getElementById("login-page");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const loginError = document.getElementById("login-error");
  const userListDiv = document.getElementById("user-list");
  const userSearchInput = document.getElementById("user-search");
  const searchClearBtn = document.getElementById("search-clear-btn");
  const chatBackBtn = document.getElementById("chat-back-btn");
  const chatTitleEl = document.getElementById("chat-username");
  const chatStatusEl = document.getElementById("chat-status");
  const headerAvatarInitials = document.getElementById("header-avatar-initials");
  const headerOnlineIndicator = document.getElementById("header-online-indicator");
  const chatBox = document.getElementById("chat-box");
  const inputWrapper = document.getElementById("input-wrapper");
  const preBtn = document.getElementById("pre-btn");
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");
  const sendBtn = document.getElementById("send-btn");
  const themeBtn = document.getElementById("theme-btn");
  const themeIcon = document.getElementById("theme-icon");
  const notificationBtn = document.getElementById("notification-btn");
  const notificationIcon = document.getElementById("notification-icon");
  const chatMenuBtn = document.getElementById("chat-menu-btn");
  const chatDropdownMenu = document.getElementById("chat-dropdown-menu");
  const clearChatBtn = document.getElementById("clear-chat-btn");
  const exportChatBtn = document.getElementById("export-chat-btn");
  const logoutMenuBtn = document.getElementById("logout-menu-btn");
  const replyContainer = document.getElementById("reply-container");
  const emojiBtn = document.getElementById("emoji-btn");

  // Shared Media Modal Elements
  const headerMediaBtn = document.getElementById("header-media-btn");
  const menuViewMediaBtn = document.getElementById("menu-view-media-btn");
  const mediaModal = document.getElementById("media-modal");
  const mediaBackdrop = document.getElementById("media-backdrop");
  const mediaCloseBtn = document.getElementById("media-close-btn");
  const mediaContentList = document.getElementById("media-content-list");
  const mediaModalTitle = document.getElementById("media-modal-title");
  const mediaTabPills = document.querySelectorAll(".media-tab-pill");

  // Lightbox Modal Elements
  const imageLightbox = document.getElementById("image-lightbox");
  const lightboxBackdrop = document.getElementById("lightbox-backdrop");
  const lightboxCloseBtn = document.getElementById("lightbox-close-btn");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");

  // Call feature triggers & modal
  const headerCallBtn = document.getElementById("header-call-btn");
  const navCallsBtn = document.getElementById("nav-calls-btn");
  const navSavedBtn = document.getElementById("nav-saved-btn");
  const navGuideBtn = document.getElementById("nav-guide-btn");
  const callDialog = document.getElementById("call-dialog");
  const callBackdrop = document.getElementById("call-backdrop");
  const callDialogClose = document.getElementById("call-dialog-close");

  // Settings Modal Elements
  const settingsModal = document.getElementById("settings-modal");
  const settingsBackdrop = document.getElementById("settings-backdrop");
  const settingsCloseBtn = document.getElementById("settings-close-btn");
  const settingsNavBtn = document.getElementById("settings-nav-btn");
  const settingsProfileName = document.getElementById("settings-profile-name");
  const settingsProfileUsername = document.getElementById("settings-profile-username");
  const settingsAvatarInitials = document.getElementById("settings-avatar-initials");
  const optThemeToggle = document.getElementById("opt-theme-toggle");
  const optCurrentTheme = document.getElementById("opt-current-theme");
  const optNotificationsToggle = document.getElementById("opt-notifications-toggle");
  const optCurrentNotifications = document.getElementById("opt-current-notifications");
  const optUserGuide = document.getElementById("opt-user-guide");
  const optExportData = document.getElementById("opt-export-data");
  const optLogout = document.getElementById("opt-logout");

  // User Guide Modal Elements
  const guideModal = document.getElementById("guide-modal");
  const guideBackdrop = document.getElementById("guide-backdrop");
  const guideCloseBtn = document.getElementById("guide-close-btn");

  // --- State Variables ---
  let currentUser = sessionStorage.getItem("chatUsername") || "";
  let currentReceiver = "";
  let chats = {}; // { [username]: [ { from, message, type, code, file, timestamp, reply, seen } ] }

  // Load saved message history from sessionStorage if available
  try {
    const savedChats = sessionStorage.getItem("talktome_chats");
    if (savedChats) {
      chats = JSON.parse(savedChats);
    }
  } catch (_) {}

  function persistChats() {
    try {
      sessionStorage.setItem("talktome_chats", JSON.stringify(chats));
    } catch (_) {}
  }
  let codeMode = false;
  let unreadCount = 0;
  let isWindowActive = document.hasFocus();
  let notificationsEnabled = localStorage.getItem("notificationsEnabled") !== "false";
  let isDarkMode = localStorage.getItem("chatTheme") !== "light";
  let typingTimer;
  let currentReply = null;
  const TYPING_TIMEOUT = 1500;
  const typingTimers = {};
  let onlineUsers = [];
  let userSearchQuery = "";

  // Apply Theme
  function applyTheme(dark) {
    isDarkMode = dark;
    if (dark) {
      document.body.classList.add("dark");
      if (themeIcon) themeIcon.className = "bi bi-moon-fill";
      if (optCurrentTheme) optCurrentTheme.textContent = "Dark";
      localStorage.setItem("chatTheme", "dark");
    } else {
      document.body.classList.remove("dark");
      if (themeIcon) themeIcon.className = "bi bi-sun-fill";
      if (optCurrentTheme) optCurrentTheme.textContent = "Light";
      localStorage.setItem("chatTheme", "light");
    }
  }
  applyTheme(isDarkMode);

  // Apply Notification state
  function updateNotificationUI() {
    if (notificationsEnabled) {
      if (notificationIcon) notificationIcon.className = "bi bi-bell-fill";
      if (optCurrentNotifications) optCurrentNotifications.textContent = "On";
    } else {
      if (notificationIcon) notificationIcon.className = "bi bi-bell-slash-fill";
      if (optCurrentNotifications) optCurrentNotifications.textContent = "Off";
    }
  }
  updateNotificationUI();

  // Dynamic Browser Title with Unread Indicator
  function updateTitleBadge() {
    unreadCount = 0;
    for (const u in chats) {
      unreadCount += (chats[u] || []).filter(m => m.type === "other" && !m.seen).length;
    }
    const badge = unreadCount > 0 ? `(${unreadCount}) ` : "";
    document.title = `${badge}TalkToMe • Real-Time Chat`;
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
      renderUserList();
      if (shouldEmit && socket && socket.connected) {
        socket.emit("messageSeen", { from: currentUser, to: user });
      }
    }
    return hasUnseen;
  }

  function getInputEl() {
    return document.getElementById("message-input");
  }

  function getInputValue() {
    const el = getInputEl();
    return el ? el.value : "";
  }

  function setInputValue(v) {
    const el = getInputEl();
    if (el) el.value = v;
  }

  // --- Reply Helpers ---
  function clearReply() {
    currentReply = null;
    if (replyContainer) {
      replyContainer.classList.add("hidden");
      replyContainer.innerHTML = "";
    }
  }

  function setReply(from, text) {
    currentReply = { from, text };
    if (!replyContainer) return;
    replyContainer.innerHTML = `
      <div class="reply-content">
        <div class="reply-to-user"><i class="bi bi-reply-fill"></i> Replying to ${escapeHtml(from)}</div>
        <div class="reply-preview-text">${escapeHtml(text)}</div>
      </div>
      <button type="button" class="reply-dismiss-btn" id="reply-cancel-btn" title="Cancel reply">
        <i class="bi bi-x-lg"></i>
      </button>
    `;
    replyContainer.classList.remove("hidden");
    const cancelBtn = document.getElementById("reply-cancel-btn");
    if (cancelBtn) cancelBtn.addEventListener("click", clearReply);
    const input = getInputEl();
    if (input) input.focus();
  }

  // --- Export All Chat Data Feature ---
  function exportAllChatData() {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const exportFileName = `TalkToMe_Export_${dateStr}.json`;

      const exportPayload = {
        application: "TalkToMe",
        exportedAt: now.toISOString(),
        currentUser: currentUser,
        chats: chats
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", exportFileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast(`Exported all chats as ${exportFileName}`, "success", 4500);
    } catch (err) {
      console.error("Export failed:", err);
      showToast("Failed to export chat data.", "error");
    }
  }

  // --- Context Menu Actions ---
  function showContextMenu(x, y, msg, from) {
    const existing = document.querySelector(".context-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.className = "context-menu";

    const menuWidth = 190;
    const menuHeight = 220;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);
    menu.style.top = `${posY}px`;
    menu.style.left = `${posX}px`;

    menu.innerHTML = `
      <div class="context-menu-item" data-action="reply">
        <i class="bi bi-reply-fill"></i>
        <span>Reply</span>
      </div>
      <div class="context-menu-item" data-action="copy">
        <i class="bi bi-copy"></i>
        <span>Copy</span>
      </div>
      <div class="context-menu-item" data-action="forward">
        <i class="bi bi-arrow-right-short"></i>
        <span>Forward</span>
      </div>
      <div class="context-menu-item" data-action="pin">
        <i class="bi bi-pin-angle"></i>
        <span>Pin</span>
      </div>
      <div class="context-menu-item danger" data-action="delete">
        <i class="bi bi-trash3"></i>
        <span>Delete</span>
      </div>
    `;

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".context-menu-item");
      if (!item) return;
      const action = item.dataset.action;

      if (action === "reply") {
        setReply(from, msg);
      } else if (action === "copy") {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(msg)
            .then(() => showToast("Copied to clipboard", "success"))
            .catch(() => showToast("Unable to copy text", "error"));
        }
      } else if (action === "forward") {
        showToast("Select a contact to forward to", "info");
      } else if (action === "pin") {
        showToast("Message pinned", "info");
      } else if (action === "delete") {
        showToast("Message deleted locally", "info");
      }
      menu.remove();
    });

    document.body.appendChild(menu);

    const dismiss = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", dismiss);
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", dismiss), 0);
  }

  // --- Message Bubble Rendering ---
  function createMessageElement(m) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper", m.type);

    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble");

    if (m.reply) {
      const replyDiv = document.createElement("div");
      replyDiv.className = "bubble-reply";
      replyDiv.innerHTML = `
        <div class="bubble-reply-author">${escapeHtml(m.reply.from || "")}</div>
        <div class="bubble-reply-text">${escapeHtml(m.reply.text || "")}</div>
      `;
      bubble.appendChild(replyDiv);
    }

    if (m.file) {
      if (m.file.type && m.file.type.startsWith("image/")) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "shared-image-wrapper";
        imgWrap.style.cursor = "pointer";
        const img = document.createElement("img");
        img.src = m.file.data;
        img.alt = m.file.name || "Shared image";
        imgWrap.appendChild(img);
        imgWrap.addEventListener("click", () => openLightbox(m.file.data, m.file.name || "Photo"));
        bubble.appendChild(imgWrap);
        if (m.message) {
          const cap = document.createElement("div");
          cap.textContent = m.message;
          bubble.appendChild(cap);
        }
      } else {
        const fileCard = document.createElement("a");
        fileCard.className = "shared-file-card";
        fileCard.href = m.file.data;
        fileCard.download = m.file.name || "file";
        fileCard.innerHTML = `
          <i class="bi bi-paperclip"></i>
          <span>${escapeHtml(m.file.name || "Download File")}</span>
        `;
        bubble.appendChild(fileCard);
      }
    } else if (m.code) {
      const codeBlock = document.createElement("div");
      codeBlock.className = "code-block-content";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = m.message;
      pre.appendChild(code);
      codeBlock.appendChild(pre);
      bubble.appendChild(codeBlock);
      if (window.hljs) {
        try { hljs.highlightElement(code); } catch (_) {}
      }
    } else {
      const textSpan = document.createElement("span");
      textSpan.textContent = m.message;
      bubble.appendChild(textSpan);
    }

    wrapper.appendChild(bubble);

    // Metadata
    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.innerHTML = `<span class="message-time">${m.timestamp || ""}</span>`;

    if (m.type === "me") {
      const ticks = document.createElement("span");
      ticks.className = `message-ticks ${m.seen ? "seen" : ""}`;
      ticks.innerHTML = `<i class="bi ${m.seen ? "bi-check2-all" : "bi-check2"}"></i>`;
      meta.appendChild(ticks);
    }
    wrapper.appendChild(meta);

    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu(e.pageX, e.pageY, m.message, m.from);
    });

    return wrapper;
  }

  function renderChat(user) {
    chatBox.innerHTML = "";
    if (!user) {
      chatBox.innerHTML = `
        <div class="empty-conversation-state">
          <div class="empty-state-icon"><i class="bi bi-chat-heart"></i></div>
          <h3>Select a conversation</h3>
          <p>Choose an online contact from the sidebar to start chatting</p>
        </div>
      `;
      return;
    }

    const list = chats[user] || [];
    if (list.length === 0) {
      const datePill = document.createElement("div");
      datePill.className = "date-pill-divider";
      datePill.textContent = "Today";
      chatBox.appendChild(datePill);
    } else {
      let lastDate = "";
      list.forEach((m) => {
        const dateKey = "Today";
        if (dateKey !== lastDate) {
          const pill = document.createElement("div");
          pill.className = "date-pill-divider";
          pill.textContent = dateKey;
          chatBox.appendChild(pill);
          lastDate = dateKey;
        }
        chatBox.appendChild(createMessageElement(m));
      });
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // --- Sidebar User List Rendering ---
  function renderUserList() {
    userListDiv.innerHTML = "";

    const filteredUsers = onlineUsers.filter((u) => {
      if (u === currentUser) return false;
      if (!userSearchQuery) return true;
      return u.toLowerCase().includes(userSearchQuery.toLowerCase());
    });

    if (filteredUsers.length === 0) {
      userListDiv.innerHTML = `
        <div class="chat-list-empty">
          <i class="bi bi-people" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
          ${userSearchQuery ? "No contacts matching search" : "No other users online right now"}
        </div>
      `;
      return;
    }

    filteredUsers.forEach((user) => {
      const item = document.createElement("div");
      item.className = `chat-item ${user === currentReceiver ? "active" : ""}`;

      const history = chats[user] || [];
      const lastMsg = history[history.length - 1];
      const previewText = lastMsg
        ? (lastMsg.file ? "📎 File attachment" : (lastMsg.code ? "💻 Code snippet" : lastMsg.message))
        : "Tap to chat";
      const timeStr = lastMsg ? (lastMsg.timestamp || "") : "";
      const unread = history.filter(m => m.type === "other" && !m.seen).length;
      const isOnline = onlineUsers.includes(user);
      const initial = user.charAt(0).toUpperCase();

      item.innerHTML = `
        <div class="chat-item-avatar">
          <span>${initial}</span>
          <span class="online-dot ${isOnline ? "" : "offline"}"></span>
        </div>
        <div class="chat-item-content">
          <div class="chat-item-top">
            <span class="chat-item-name">${escapeHtml(user)}</span>
            <span class="chat-item-time">${timeStr}</span>
          </div>
          <div class="chat-item-bottom">
            <span class="chat-item-preview">${escapeHtml(previewText)}</span>
            ${unread > 0 ? `<span class="chat-item-badge">${unread}</span>` : ""}
          </div>
        </div>
      `;

      item.addEventListener("click", () => {
        selectUserConversation(user);
      });

      userListDiv.appendChild(item);
    });
  }

  function selectUserConversation(user) {
    currentReceiver = user;
    renderUserList();

    chatTitleEl.textContent = user;
    const isOnline = onlineUsers.includes(user);
    chatStatusEl.textContent = isOnline ? "Online" : "Offline";
    headerAvatarInitials.textContent = user.charAt(0).toUpperCase();
    headerOnlineIndicator.className = `online-indicator ${isOnline ? "online" : ""}`;

    markConversationSeen(user, true);
    renderChat(user);
    updateTitleBadge();

    appLayout.classList.add("conversation-active");
  }

  // --- Send Message ---
  function sendMessage() {
    const msg = getInputValue().trim();
    if (!msg) return;
    if (!currentReceiver) {
      showToast("Please select a contact to message", "info");
      return;
    }

    if (!socket || !socket.connected) {
      showToast("Cannot send message: Not connected to server", "error");
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const payload = {
      from: currentUser,
      to: currentReceiver,
      message: msg,
      code: !!codeMode,
      timestamp: timestamp
    };

    if (currentReply) {
      payload.reply = currentReply;
    }

    socket.emit("chatMessage", payload);

    if (!chats[currentReceiver]) chats[currentReceiver] = [];
    chats[currentReceiver].push({
      from: currentUser,
      message: msg,
      type: "me",
      code: !!codeMode,
      seen: false,
      timestamp: timestamp,
      reply: currentReply
    });
    persistChats();

    renderChat(currentReceiver);
    renderUserList();
    setInputValue("");
    clearReply();
  }

  // --- Lightbox Handlers ---
  function openLightbox(src, caption) {
    if (!imageLightbox) return;
    lightboxImg.src = src;
    lightboxCaption.textContent = caption || "";
    imageLightbox.classList.remove("hidden");
  }

  function closeLightbox() {
    if (!imageLightbox) return;
    imageLightbox.classList.add("hidden");
    lightboxImg.src = "";
  }

  // --- Shared Media & Files Gallery Handlers ---
  let activeMediaFilter = "all";

  function openMediaGallery() {
    if (!mediaModal) return;
    if (!currentReceiver) {
      showToast("Select a conversation to view its shared media", "info");
      return;
    }
    mediaModalTitle.textContent = `Shared Media (${currentReceiver})`;
    renderMediaGallery(activeMediaFilter);
    mediaModal.classList.remove("hidden");
  }

  function closeMediaGallery() {
    if (mediaModal) mediaModal.classList.add("hidden");
  }

  function renderMediaGallery(filter) {
    if (!mediaContentList || !currentReceiver) return;
    mediaContentList.innerHTML = "";

    const history = chats[currentReceiver] || [];
    const filesInChat = history.filter(m => !!m.file);

    if (filesInChat.length === 0) {
      mediaContentList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
          <i class="bi bi-images" style="font-size: 38px; display: block; margin-bottom: 10px; opacity: 0.6;"></i>
          No media or documents shared in this chat yet.
        </div>
      `;
      return;
    }

    const images = filesInChat.filter(m => m.file.type && m.file.type.startsWith("image/"));
    const docs = filesInChat.filter(m => !m.file.type || !m.file.type.startsWith("image/"));

    // Render Images (Grid)
    if ((filter === "all" || filter === "images") && images.length > 0) {
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "media-grid-section-title";
      sectionTitle.textContent = `Photos & Images (${images.length})`;
      mediaContentList.appendChild(sectionTitle);

      const grid = document.createElement("div");
      grid.className = "media-image-grid";

      images.forEach((m) => {
        const item = document.createElement("div");
        item.className = "media-grid-item";
        item.innerHTML = `<img src="${m.file.data}" alt="${escapeHtml(m.file.name || 'Photo')}" loading="lazy" />`;
        item.addEventListener("click", () => {
          openLightbox(m.file.data, m.file.name || "Shared Photo");
        });
        grid.appendChild(item);
      });

      mediaContentList.appendChild(grid);
    }

    // Render Docs & Other Files (Rows)
    if ((filter === "all" || filter === "docs") && docs.length > 0) {
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "media-grid-section-title";
      sectionTitle.textContent = `Documents & Files (${docs.length})`;
      mediaContentList.appendChild(sectionTitle);

      const fileList = document.createElement("div");
      fileList.className = "media-file-list";

      docs.forEach((m) => {
        const row = document.createElement("a");
        row.className = "media-file-row";
        row.href = m.file.data;
        row.download = m.file.name || "file";

        row.innerHTML = `
          <div class="media-file-icon"><i class="bi bi-file-earmark-text-fill"></i></div>
          <div class="media-file-info">
            <div class="media-file-name">${escapeHtml(m.file.name || 'Document')}</div>
            <div class="media-file-meta">Shared by ${escapeHtml(m.from)} • ${m.timestamp || ''}</div>
          </div>
          <div class="media-file-download-btn"><i class="bi bi-download"></i></div>
        `;

        fileList.appendChild(row);
      });

      mediaContentList.appendChild(fileList);
    }

    if (
      (filter === "images" && images.length === 0) ||
      (filter === "docs" && docs.length === 0)
    ) {
      mediaContentList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 50px 20px;">
          No ${filter === "images" ? "photos" : "documents"} found in this conversation.
        </div>
      `;
    }
  }

  // --- Settings Drawer Handlers ---
  function openSettings() {
    if (!settingsModal) return;
    settingsProfileName.textContent = currentUser;
    settingsProfileUsername.textContent = `@${currentUser}`;
    settingsAvatarInitials.textContent = currentUser.charAt(0).toUpperCase();
    settingsModal.classList.remove("hidden");
  }

  function closeSettings() {
    if (settingsModal) settingsModal.classList.add("hidden");
  }

  // --- User Guide Handlers ---
  function openGuide() {
    if (guideModal) guideModal.classList.remove("hidden");
  }

  function closeGuide() {
    if (guideModal) guideModal.classList.add("hidden");
  }

  // --- Call Dialog Handlers ---
  function openCallDialog() {
    if (callDialog) callDialog.classList.remove("hidden");
  }

  function closeCallDialog() {
    if (callDialog) callDialog.classList.add("hidden");
  }

  // --- Login Form Handler ---
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const desired = usernameInput.value.trim();
    if (!desired) return;

    if (!socket || !socket.connected) {
      loginError.textContent = "Connecting to server... please wait.";
      showToast("Server connection in progress. Please retry in a moment.", "error");
      return;
    }

    loginError.textContent = "Signing in…";
    socket.emit("register", desired, (res) => {
      if (!res || !res.ok) {
        const errMsg = (res && res.error) || "Login failed";
        loginError.textContent = errMsg;
        showToast(errMsg, "error");
        return;
      }

      currentUser = res.username;
      loginError.textContent = "";
      sessionStorage.setItem("chatUsername", desired);
      loginPage.style.display = "none";
      appLayout.classList.remove("hidden");
      socket.emit("requestUserList");
      updateTitleBadge();
      showToast(`Welcome to TalkToMe, ${currentUser}!`, "success");
    });
  });

  // --- Socket Events ---
  if (socket) {
    socket.on("connect", () => {
      loginError.textContent = "";
      const stored = sessionStorage.getItem("chatUsername") || currentUser;
      if (stored) {
        socket.emit("register", stored, (res) => {
          if (res && res.ok) {
            currentUser = res.username;
            loginPage.style.display = "none";
            appLayout.classList.remove("hidden");
            socket.emit("requestUserList");
            if (currentReceiver) {
              renderChat(currentReceiver);
            }
            showToast(`Connected as ${currentUser}`, "success", 2500);
          } else {
            sessionStorage.removeItem("chatUsername");
          }
        });
      }
    });

    socket.on("connect_error", () => {
      loginError.textContent = "⚠ Unable to reach server. Retrying…";
      showToast("Connection to server lost. Reconnecting…", "error", 3000);
    });

    socket.on("disconnect", () => {
      if (!currentUser) {
        loginError.textContent = "⚠ Disconnected from server.";
      } else {
        showToast("Disconnected from chat server", "error", 3000);
      }
    });

    socket.on("forceLogout", () => {
      showToast("Signed out because your username logged in elsewhere.", "error", 6000);
      currentUser = "";
      loginPage.style.display = "flex";
      appLayout.classList.add("hidden");
      chats = {};
      chatBox.innerHTML = "";
      localStorage.clear();
      unreadCount = 0;
      updateTitleBadge();
    });

    socket.on("userList", (users) => {
      onlineUsers = users.slice();
      renderUserList();
      if (currentReceiver) {
        const isOnline = onlineUsers.includes(currentReceiver);
        chatStatusEl.textContent = isOnline ? "Online" : "Offline";
        headerOnlineIndicator.className = `online-indicator ${isOnline ? "online" : ""}`;
      }
    });

    socket.on("chatMessage", (data) => {
      const { from, message, code, file, timestamp, reply } = data;
      if (!chats[from]) chats[from] = [];
      chats[from].push({
        from,
        message,
        type: "other",
        code: !!code,
        seen: false,
        file,
        timestamp,
        reply
      });
      persistChats();

      if (currentReceiver === from) {
        if (!document.hidden && isWindowActive) {
          markConversationSeen(from, true);
        }
        renderChat(from);
      } else {
        showToast(`New message from ${from}`, "info", 3500);
      }

      renderUserList();
      updateTitleBadge();

      if (notificationsEnabled && (document.hidden || !isWindowActive) && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`New message from ${from}`, {
          body: message || "Attachment file"
        });
      }
    });

    socket.on("messageSeen", (data) => {
      const { from } = data;
      if (!chats[from]) return;
      chats[from].forEach((m) => {
        if (m.type === "me") m.seen = true;
      });
      if (currentReceiver === from) {
        renderChat(from);
      }
    });

    socket.on("typing", (data) => {
      const { from, isTyping } = data;
      if (currentReceiver !== from) return;
      if (isTyping) {
        chatStatusEl.textContent = "Typing...";
        clearTimeout(typingTimers[from]);
        typingTimers[from] = setTimeout(() => {
          chatStatusEl.textContent = "Online";
        }, 3000);
      } else {
        chatStatusEl.textContent = "Online";
        clearTimeout(typingTimers[from]);
      }
    });
  }

  // --- Event Listeners ---

  // Back button on mobile
  if (chatBackBtn) {
    chatBackBtn.addEventListener("click", () => {
      appLayout.classList.remove("conversation-active");
    });
  }

  // Search filter
  if (userSearchInput) {
    userSearchInput.addEventListener("input", (e) => {
      userSearchQuery = e.target.value.trim();
      if (searchClearBtn) {
        searchClearBtn.classList.toggle("visible", userSearchQuery.length > 0);
      }
      renderUserList();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      userSearchInput.value = "";
      userSearchQuery = "";
      searchClearBtn.classList.remove("visible");
      renderUserList();
      userSearchInput.focus();
    });
  }

  // Theme Toggles
  if (themeBtn) themeBtn.addEventListener("click", () => applyTheme(!isDarkMode));
  if (optThemeToggle) optThemeToggle.addEventListener("click", () => applyTheme(!isDarkMode));

  // Notification Toggles
  const toggleNotifications = () => {
    notificationsEnabled = !notificationsEnabled;
    localStorage.setItem("notificationsEnabled", String(notificationsEnabled));
    updateNotificationUI();
    showToast(`Notifications ${notificationsEnabled ? "enabled" : "disabled"}`, "info");
    if (notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };
  if (notificationBtn) notificationBtn.addEventListener("click", toggleNotifications);
  if (optNotificationsToggle) optNotificationsToggle.addEventListener("click", toggleNotifications);

  // Send message events
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);

  if (inputWrapper) {
    inputWrapper.addEventListener("keydown", (e) => {
      const el = getInputEl();
      if (el && el.tagName.toLowerCase() === "input" && e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

    inputWrapper.addEventListener("input", (e) => {
      const el = e.target;
      if (!el || el.id !== "message-input" || !currentReceiver || !socket) return;
      socket.emit("typing", { from: currentUser, to: currentReceiver, isTyping: true });
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket.emit("typing", { from: currentUser, to: currentReceiver, isTyping: false });
      }, TYPING_TIMEOUT);
    });
  }

  // Code Mode Toggle
  if (preBtn) {
    preBtn.addEventListener("click", () => {
      codeMode = !codeMode;
      preBtn.classList.toggle("active", codeMode);
      const cur = getInputValue();
      inputWrapper.innerHTML = "";
      if (codeMode) {
        const ta = document.createElement("textarea");
        ta.id = "message-input";
        ta.placeholder = "Paste or type code snippet here...";
        ta.rows = 4;
        ta.value = cur;
        inputWrapper.appendChild(ta);
        showToast("Code snippet mode active", "info", 2000);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = "message-input";
        inp.placeholder = "Type a message...";
        inp.value = cur;
        inputWrapper.appendChild(inp);
      }
      getInputEl().focus();
    });
  }

  // Attachments
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      if (!currentReceiver) {
        showToast("Please select a contact to share files with", "info");
        return;
      }
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast("File is too large (maximum allowed size: 5MB)", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const fileData = { name: file.name, type: file.type, data: evt.target.result };
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        if (socket && socket.connected) {
          socket.emit("chatMessage", {
            from: currentUser,
            to: currentReceiver,
            message: "",
            code: false,
            file: fileData,
            timestamp: timestamp
          });

          if (!chats[currentReceiver]) chats[currentReceiver] = [];
          chats[currentReceiver].push({
            from: currentUser,
            message: "",
            type: "me",
            code: false,
            seen: false,
            file: fileData,
            timestamp: timestamp
          });
          persistChats();

          renderChat(currentReceiver);
          renderUserList();
          showToast("Attachment sent", "success");
        } else {
          showToast("Unable to send file: server connection unavailable", "error");
        }
      };
      reader.readAsDataURL(file);
      fileInput.value = "";
    });
  }

  // Dropdown Menu
  if (chatMenuBtn && chatDropdownMenu) {
    chatMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chatDropdownMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!chatMenuBtn.contains(e.target) && !chatDropdownMenu.contains(e.target)) {
        chatDropdownMenu.classList.add("hidden");
      }
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (!currentReceiver) return;
      chats[currentReceiver] = [];
      renderChat(currentReceiver);
      renderUserList();
      chatDropdownMenu.classList.add("hidden");
      showToast(`Cleared conversation with ${currentReceiver}`, "info");
    });
  }

  if (exportChatBtn) {
    exportChatBtn.addEventListener("click", () => {
      chatDropdownMenu.classList.add("hidden");
      exportAllChatData();
    });
  }

  // Shared Media Modal Triggers
  if (headerMediaBtn) headerMediaBtn.addEventListener("click", openMediaGallery);
  if (menuViewMediaBtn) {
    menuViewMediaBtn.addEventListener("click", () => {
      chatDropdownMenu.classList.add("hidden");
      openMediaGallery();
    });
  }
  if (mediaCloseBtn) mediaCloseBtn.addEventListener("click", closeMediaGallery);
  if (mediaBackdrop) mediaBackdrop.addEventListener("click", closeMediaGallery);

  mediaTabPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      mediaTabPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeMediaFilter = pill.dataset.filter;
      renderMediaGallery(activeMediaFilter);
    });
  });

  const menuThemeBtn = document.getElementById("menu-theme-btn");
  const menuCallBtn = document.getElementById("menu-call-btn");

  if (menuThemeBtn) {
    menuThemeBtn.addEventListener("click", () => {
      chatDropdownMenu.classList.add("hidden");
      applyTheme(!isDarkMode);
    });
  }

  if (menuCallBtn) {
    menuCallBtn.addEventListener("click", () => {
      chatDropdownMenu.classList.add("hidden");
      openCallDialog();
    });
  }

  // Lightbox Modal Triggers
  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener("click", closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", closeLightbox);

  // Calling Dialog triggers
  if (headerCallBtn) headerCallBtn.addEventListener("click", openCallDialog);
  if (navCallsBtn) navCallsBtn.addEventListener("click", openCallDialog);
  if (callBackdrop) callBackdrop.addEventListener("click", closeCallDialog);
  if (callDialogClose) callDialogClose.addEventListener("click", closeCallDialog);

  // Saved messages shortcut
  if (navSavedBtn) {
    navSavedBtn.addEventListener("click", () => {
      showToast("Saved messages bookmark view is coming soon!", "info");
    });
  }

  // User Guide Modal triggers
  if (navGuideBtn) navGuideBtn.addEventListener("click", openGuide);
  if (optUserGuide) optUserGuide.addEventListener("click", () => {
    closeSettings();
    openGuide();
  });
  if (guideCloseBtn) guideCloseBtn.addEventListener("click", closeGuide);
  if (guideBackdrop) guideBackdrop.addEventListener("click", closeGuide);

  // Export Data from Settings
  if (optExportData) {
    optExportData.addEventListener("click", () => {
      closeSettings();
      exportAllChatData();
    });
  }

  // Logout Handlers
  const handleLogout = () => {
    currentUser = "";
    loginPage.style.display = "flex";
    appLayout.classList.add("hidden");
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
    chats = {};
    chatBox.innerHTML = "";
    sessionStorage.clear();
    unreadCount = 0;
    updateTitleBadge();
    closeSettings();
    showToast("Signed out successfully. In-memory messages cleared.", "info");
  };

  if (logoutMenuBtn) logoutMenuBtn.addEventListener("click", handleLogout);
  if (optLogout) optLogout.addEventListener("click", handleLogout);

  // Settings Modal triggers
  if (settingsNavBtn) settingsNavBtn.addEventListener("click", openSettings);
  if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", closeSettings);
  if (settingsBackdrop) settingsBackdrop.addEventListener("click", closeSettings);

  // Emoji button prompt
  if (emojiBtn) {
    emojiBtn.addEventListener("click", () => {
      const el = getInputEl();
      if (el) {
        el.focus();
        showToast("Use your device keyboard to select emojis", "info", 2000);
      }
    });
  }

  // Window Focus & Seen Tracking
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

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isWindowActive && currentReceiver) {
      markConversationSeen(currentReceiver, true);
    }
  });
});
