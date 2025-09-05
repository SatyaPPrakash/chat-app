const socket = io();
// const socket = io("http://localhost:3000");

const loginPage = document.getElementById("login-page");
const chatPage = document.getElementById("chat-page");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const preBtn = document.getElementById("pre-btn");
const userListDiv = document.getElementById("user-list");
const chatHeader = document.getElementById("chat-header");

let currentUser = "";
let currentReceiver = "";
let chats = {};
let pre = false

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    currentUser = usernameInput.value.trim();
    if (currentUser) {
        socket.emit("register", currentUser);
        loginPage.style.display = "none";
        chatPage.classList.remove("hidden");
    }
});


sendBtn.addEventListener("click", sendMessage);
function sendMessage() {
    const msg = messageInput.value.trim();
    if (msg && currentReceiver) {
        socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: msg });

        if (!chats[currentReceiver]) chats[currentReceiver] = [];
        chats[currentReceiver].push({ from: currentUser, message: msg, type: "me" });
        
        renderChat(currentReceiver);
        messageInput.value = "";
    } else {
        alert("Select a user to chat with!");
    }
}

preBtn.addEventListener("click", () => {
    pre = !pre;
});

socket.on("chatMessage", ({ from, message }) => {
    if (!chats[from]) chats[from] = [];
    chats[from].push({ from, message, type: "other" });

    if (currentReceiver === from) {
        renderChat(from);
    }
});


socket.on("userList", (users) => {
    userListDiv.innerHTML = "";
    users.forEach((user) => {
        if (user !== currentUser) {
            const btn = document.createElement("button");
            btn.textContent = user;
            if (user === currentReceiver) btn.classList.add("active");
            btn.onclick = () => {
                currentReceiver = user;
                chatHeader.textContent = `${currentUser} Chatting with ${user}`;
                document.querySelectorAll("#user-list button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderChat(user);
            };

            userListDiv.appendChild(btn);
        }
    });
});

function addMessage(msg, type) {
    const div = document.createElement("div");
    const br = document.createElement("br");
    div.textContent = msg;
    div.classList.add("message", type);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function renderChat(user) {
    chatBox.innerHTML = ""; 
    if (chats[user]) {
        chats[user].forEach(({ from, message, type }) => {
            addMessage(`${from}: ${message}`, type);
        });
    }
}
