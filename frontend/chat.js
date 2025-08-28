const socket = io("http://localhost:3000");

const loginPage = document.getElementById("login-page");
const chatPage = document.getElementById("chat-page");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const userListDiv = document.getElementById("user-list");
const chatHeader = document.getElementById("chat-header");

let currentUser = "";
let currentReceiver = "";

// Handle login
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    currentUser = usernameInput.value.trim();
    if (currentUser) {
        socket.emit("register", currentUser);
        loginPage.classList.add("hidden");
        chatPage.classList.remove("hidden");
    }
});

// Send message
sendBtn.addEventListener("click", () => {
    const msg = messageInput.value.trim();
    if (msg && currentReceiver) {
        socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: msg });
        console.log("Sending:", { from: currentUser, to: currentReceiver, msg });
        addMessage(`Me: ${msg}`, "me");
        messageInput.value = "";
    } else {
        alert("Select a user to chat with!");
    }
});

// Receive messages
socket.on("chatMessage", ({ from, message }) => {
    console.log("Received:", { from, message });
    addMessage(`${from}: ${message}`, "other");
});

// Update online users list
socket.on("userList", (users) => {
    userListDiv.innerHTML = "";
    users.forEach((user) => {
        if (user !== currentUser) {
            const btn = document.createElement("button");
            btn.textContent = user;
            if (user === currentReceiver) btn.classList.add("active");
            btn.onclick = () => {
                currentReceiver = user;
                chatHeader.textContent = `Chatting with ${user}`;
                document.querySelectorAll("#user-list button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            };
            userListDiv.appendChild(btn);
        }
    });
});

function addMessage(msg, type) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.classList.add("message", type);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}
