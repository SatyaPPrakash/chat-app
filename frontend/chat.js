// const socket = io();
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

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    currentUser = usernameInput.value.trim();
    if (currentUser) {
        socket.emit("register", currentUser);
        loginPage.style.display = "none";
        chatPage.classList.remove("hidden");
    }
});


sendBtn.addEventListener("click", () => {
    const msg = messageInput.value.trim();
    if (msg && currentReceiver) {
        socket.emit("chatMessage", { from: currentUser, to: currentReceiver, message: msg });
        addMessage(`${currentReceiver}: ${msg}`, "me");
        messageInput.value = "";
    } else {
        alert("Select a user to chat with!");
    }
});

socket.on("chatMessage", ({ from, message }) => {
    addMessage(`${from}: ${message}`, "other");
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
    // chatBox.appendChild(br);
    chatBox.scrollTop = chatBox.scrollHeight;
}
