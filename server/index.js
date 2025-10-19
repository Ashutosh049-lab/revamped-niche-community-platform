const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4001;
const ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: ORIGIN, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ORIGIN, credentials: true },
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // Rooms per community for scoped broadcasts
  socket.on('room:join', (communityId) => {
    if (!communityId) return;
    socket.join(`community:${communityId}`);
  });

  socket.on('room:leave', (communityId) => {
    if (!communityId) return;
    socket.leave(`community:${communityId}`);
  });

  // Broadcast events (scoped to community room when possible)
  socket.on('post:new', (post) => {
    const room = post && post.communityId ? `community:${post.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('post:new', post);
    } else {
      socket.broadcast.emit('post:new', post);
    }
  });

  socket.on('comment:new', (comment) => {
    const room = comment && comment.communityId ? `community:${comment.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('comment:new', comment);
    } else {
      socket.broadcast.emit('comment:new', comment);
    }
  });

  // Voting events
  socket.on('vote:update', (voteData) => {
    const room = voteData.communityId ? `community:${voteData.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('vote:update', voteData);
    } else {
      socket.broadcast.emit('vote:update', voteData);
    }
  });

  // Reaction events
  socket.on('reaction:update', (reactionData) => {
    const room = reactionData.communityId ? `community:${reactionData.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('reaction:update', reactionData);
    } else {
      socket.broadcast.emit('reaction:update', reactionData);
    }
  });

  // Poll events
  socket.on('poll:new', (pollData) => {
    const room = pollData.communityId ? `community:${pollData.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('poll:new', pollData);
    } else {
      socket.broadcast.emit('poll:new', pollData);
    }
  });

  socket.on('poll:vote', (voteData) => {
    const room = voteData.communityId ? `community:${voteData.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('poll:vote', voteData);
    } else {
      socket.broadcast.emit('poll:vote', voteData);
    }
  });

  // User activity tracking
  socket.on('user:activity', (activity) => {
    const room = activity.communityId ? `community:${activity.communityId}` : undefined;
    if (room) {
      socket.to(room).emit('user:activity', activity);
    }
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
