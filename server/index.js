const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ORIGIN, credentials: true },
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // Example broadcast events (to be integrated with Firestore later)
  socket.on('post:new', (post) => {
    socket.broadcast.emit('post:new', post);
  });

  socket.on('comment:new', (comment) => {
    socket.broadcast.emit('comment:new', comment);
  });

  socket.on('disconnect', (reason) => {
    console.log('socket disconnected', socket.id, reason);
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`Socket.io server running on :${PORT}`);
});
