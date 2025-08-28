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

app.use(express.static(path.join(__dirname, "../frontend")));

let users = {};

io.on("connection", (socket) => {
  socket.on("register", (username) => {
    users[username] = socket.id;
    io.emit("userList", Object.keys(users));
  });

  socket.on("chatMessage", ({ from, to, message }) => {
    if (users[to]) {
      io.to(users[to]).emit("chatMessage", { from, message });
    }
  });

  socket.on("disconnect", () => {
    for (let name in users) {
      if (users[name] === socket.id) {
        delete users[name];
        break;
      }
    }
    io.emit("userList", Object.keys(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
