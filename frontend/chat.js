document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Elements
    const loginPage = document.getElementById("login-page");
    const chatPage = document.getElementById("chat-page");
    const loginForm = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const userListDiv = document.getElementById("user-list");
    const chatHeader = document.getElementById("chat-header");
    const chatBox = document.getElementById("chat-box");
    const inputWrapper = document.getElementById("input-wrapper");
    const preBtn = document.getElementById("pre-btn");
    const sendBtn = document.getElementById("send-btn");
    const themeBtn = document.getElementById("theme-btn");
    const sidebarBtn = document.getElementById("sidebar-btn");
    let codeMode = false;

    // State
    let currentUser = "";
    let currentReceiver = "";
    let chats = {}; // { userDisplay: [ { from, message, type, code } ] }

    // Safe getter for input value (handles input or textarea)
    function getInputEl() { return document.getElementById("message-input"); }
    function getInputValue() { const el = getInputEl(); return el ? el.value : ""; }
    function setInputValue(v) { const el = getInputEl(); if (el) el.value = v; }

    // Send
    function sendMessage() {
        const msg = getInputValue();
        if (!msg) return;
        if (!currentReceiver) { alert("Select a user to chat with"); return; }

        // emit with code flag
        socket.emit("chatMessage", {
            from: currentUser,
            to: currentReceiver,
            message: msg,
            code: !!codeMode
        });

        // store locally
        if (!chats[currentReceiver]) chats[currentReceiver] = [];
        chats[currentReceiver].push({ from: currentUser, message: msg, type: "me", code: !!codeMode });
        renderChat(currentReceiver);
        setInputValue("");
    }

    sendBtn?.addEventListener("click", sendMessage);
    // allow Enter to send in text input (not textarea)
    inputWrapper.addEventListener("keydown", (e) => {
        const el = getInputEl();
        if (!el) return;
        if (el.tagName.toLowerCase() === "input" && e.key === "Enter") {
            e.preventDefault(); sendMessage();
        }
    });

    // toggle code input mode (swap input <-> textarea)
    preBtn?.addEventListener("click", () => {
        codeMode = !codeMode;
        preBtn.classList.toggle("active", codeMode);

        const currentText = getInputValue();
        inputWrapper.innerHTML = "";
        if (codeMode) {
            const ta = document.createElement("textarea");
            ta.id = "message-input";
            ta.placeholder = "Paste or type code here...";
            ta.rows = 6;
            ta.value = currentText;
            inputWrapper.appendChild(ta);
        } else {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.id = "message-input";
            inp.placeholder = "Type a message...";
            inp.value = currentText;
            inputWrapper.appendChild(inp);
        }
        getInputEl()?.focus();
    });

    // Theme toggle
    themeBtn?.addEventListener("click", () => document.body.classList.toggle("dark"));

    // Sidebar toggle (safe)
    sidebarBtn?.addEventListener("click", () => {
        const sidebar = document.querySelector(".sidebar");
        const chatWindow = document.querySelector(".chat-window");
        if (sidebar) { 
            sidebar.classList.toggle("collapsed");
            chatWindow.style.width = "100vw";
        }
    });

    // renderer
    function addMessage(msg, type, code = false, from = "") {
        const wrapper = document.createElement("div");
        wrapper.classList.add("message", type);
        if (code) {
            wrapper.classList.add("code-block");
            const label = document.createElement("div");
            label.textContent = from + ":";
            const pre = document.createElement("pre");
            const codeTag = document.createElement("code");
            codeTag.textContent = msg;
            pre.appendChild(codeTag);
            wrapper.appendChild(label);
            wrapper.appendChild(pre);
            chatBox.appendChild(wrapper);

            // highlight if available
            try { if (window.hljs && typeof hljs.highlightElement === "function") hljs.highlightElement(codeTag); } catch (e) {/*safe*/ }

        } else {
            wrapper.textContent = from + ": " + msg;
            chatBox.appendChild(wrapper);
        }
        // keep scroll at bottom
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function renderChat(user) {
        chatBox.innerHTML = "";
        const list = chats[user] || [];
        list.forEach(({ from, message, type, code }) => addMessage(message, type, !!code, from));
    }

    // socket listeners
    socket.on("chatMessage", ({ from, message, code }) => {
        if (!chats[from]) chats[from] = [];
        chats[from].push({ from, message, type: "other", code: !!code });
        if (currentReceiver === from) renderChat(from);
    });

    socket.on("userList", (users) => {
        // users is array of displays (server sends full list); filter out self
        userListDiv.innerHTML = "";
        users.forEach((user) => {
            if (user === currentUser) return;
            const btn = document.createElement("button");
            btn.textContent = user;
            if (user === currentReceiver) btn.classList.add("active");
            btn.addEventListener("click", () => {
                currentReceiver = user;
                document.getElementById("chat-title").textContent = `${currentUser} — chatting with ${user}`;
                document.querySelectorAll("#user-list button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderChat(user);
            });
            userListDiv.appendChild(btn);
        });
    });

    // login flow
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
            // request user list (server emits automatically, but ensure we have fresh list)
            socket.emit("requestUserList");
        });
    });

    // requestUserList handler (server may not need it but safe)
    socket.on("connect", () => {
        /*noop*/
    });

});
