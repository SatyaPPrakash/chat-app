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

const users = new Map(); // norm -> { id, display }

io.on("connection", (socket) => {
  socket.on("register", (rawName, ack) => {
    const display = String(rawName || "").trim();
    const norm = display.toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(display)) {
      return ack?.({ ok: false, error: "3–20 chars: letters, numbers, _" });
    }
    if (users.has(norm)) return ack?.({ ok: false, error: "Username already taken" });

    users.set(norm, { id: socket.id, display });
    socket.data.usernameNorm = norm;
    ack?.({ ok: true, username: display });

    // emit full list (clients will hide their own name)
    io.emit("userList", Array.from(users.values()).map(u => u.display));
  });

  socket.on("chatMessage", ({ from, to, message, code }) => {
    if (!to || !from) return;
    if (from.toLowerCase() === String(to || "").toLowerCase()) return; // ignore self-send
    const target = users.get(String(to || "").toLowerCase());
    if (target) {
      io.to(target.id).emit("chatMessage", { from, message, code: !!code });
    }
  });

  socket.on("requestUserList", () => {
    io.to(socket.id).emit("userList", Array.from(users.values()).map(u => u.display));
  });

  socket.on("disconnect", () => {
    const norm = socket.data.usernameNorm;
    if (norm && users.get(norm)?.id === socket.id) users.delete(norm);
    io.emit("userList", Array.from(users.values()).map(u => u.display));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
