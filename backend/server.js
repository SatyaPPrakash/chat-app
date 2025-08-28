const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

let users = {}; // { username: socket.id }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (username) => {
    users[username] = socket.id;
    console.log("Registered:", username);

    // ✅ Send updated user list to everyone
    io.emit("userList", Object.keys(users));
  });

  socket.on("chatMessage", ({ from, to, message }) => {
    console.log(`${from} -> ${to}: ${message}`);
    if (users[to]) {
      io.to(users[to]).emit("chatMessage", { from, message });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let name in users) {
      if (users[name] === socket.id) {
        delete users[name];
        break;
      }
    }
    // ✅ Update everyone when a user leaves
    io.emit("userList", Object.keys(users));
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
