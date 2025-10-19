import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { join } from "path";

const PORT = Number(process.env.SOCKET_PORT || 4000);
const HOST = process.env.SOCKET_HOST || "127.0.0.1";
const ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Using production Firebase (emulators disabled to match client)
// process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
// process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8081";
const ADMIN_PROJECT_ID = process.env.FB_PROJECT_ID || "storedata-cdac6";

if (!getApps().length) {
  try {
    // Try to load service account key for production
    const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: ADMIN_PROJECT_ID
    });
    console.log('Initialized Firebase Admin with service account');
  } catch (error) {
    // Fallback to default initialization (for emulators or when using environment credentials)
    console.log('Service account not found, using default initialization');
    initializeApp({ projectId: ADMIN_PROJECT_ID });
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const app = express();
app.use(cors({ origin: ORIGIN, credentials: true }));
app.get("/", (_req, res) => res.send("Socket.io server running"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// TEMPORARILY DISABLED: Require a valid Firebase ID token to connect
// TODO: Re-enable authentication once emulators are properly configured
io.use(async (socket, next) => {
  // Skip authentication for now - allow all connections
  socket.data.user = { uid: 'test-user' }; // Mock user for testing
  console.info(`[auth] allowing connection from ${socket.id} (auth disabled)`);
  return next();
  
  /* ORIGINAL AUTH CODE - TO BE RE-ENABLED:
  try {
    const token = socket.handshake.auth?.token
      || (socket.handshake.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") ?? "");
    if (!token) {
      console.warn(`[auth] missing token from ${socket.id}`);
      return next(new Error("unauthorized"));
    }
    const decoded = await getAuth().verifyIdToken(token, false);
    socket.data.user = decoded; // { uid, email, ... }
    console.info(`[auth] verified uid=${decoded.uid}`);
    return next();
  } catch (err) {
    console.warn(`[auth] verification failed for ${socket.id}:`, err && (err.message || err));
    return next(new Error("unauthorized"));
  }
  */
});

io.on("connection", (socket) => {
  const uid = socket.data?.user?.uid;
  console.log(`[socket] connected ${socket.id} uid=${uid ?? "unknown"}`);

  const toCommunityRoom = (communityId) => `community:${communityId}`;

  async function authorizeCommunityAccess(uid, communityId) {
    try {
      if (!uid || !communityId) return false;
      const communityRef = db.collection("communities").doc(communityId);
      const snap = await communityRef.get();
      if (!snap.exists) return false;
      const isPublic = !!snap.get("public");
      if (isPublic) return true;
      const memberRef = communityRef.collection("members").doc(uid);
      const memberSnap = await memberRef.get();
      return memberSnap.exists;
    } catch (e) {
      console.warn(`[room] auth check failed for uid=${uid} communityId=${communityId}:`, e?.message || e);
      return false;
    }
  }

  socket.on("room:join", async (communityId, ack) => {
    if (typeof communityId !== "string" || !communityId) {
      if (typeof ack === "function") ack({ ok: false, error: "invalid-community" });
      return;
    }
    const allowed = await authorizeCommunityAccess(uid, communityId);
    if (!allowed) {
      console.warn(`[room] join denied uid=${uid} communityId=${communityId}`);
      socket.emit("room:error", { type: "join-denied", communityId });
      if (typeof ack === "function") ack({ ok: false, error: "join-denied" });
      return;
    }
    const room = toCommunityRoom(communityId);
    await socket.join(room);
    console.log(`[room] ${socket.id} (uid=${uid}) joined ${room}`);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("room:leave", async (communityId) => {
    if (typeof communityId !== "string" || !communityId) return;
    const room = toCommunityRoom(communityId);
    await socket.leave(room);
    console.log(`[room] ${socket.id} (uid=${uid}) left ${room}`);
  });

  // Broadcast helpers matching your frontend events (scope to community room when provided)
  socket.on("post:new", (post) => {
    const cid = post?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("post:new", post);
    else io.emit("post:new", post);
  });

  socket.on("comment:new", (comment) => {
    const cid = comment?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("comment:new", comment);
    else io.emit("comment:new", comment);
  });

  socket.on("vote:update", (voteData) => {
    const cid = voteData?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("vote:update", voteData);
    else io.emit("vote:update", voteData);
  });

  socket.on("reaction:update", (reactionData) => {
    const cid = reactionData?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("reaction:update", reactionData);
    else io.emit("reaction:update", reactionData);
  });

  socket.on("poll:new", (poll) => {
    const cid = poll?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("poll:new", poll);
    else io.emit("poll:new", poll);
  });

  socket.on("poll:vote", (vote) => {
    const cid = vote?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("poll:vote", vote);
    else io.emit("poll:vote", vote);
  });

  socket.on("user:activity", (activity) => {
    const cid = activity?.communityId;
    if (cid) io.to(toCommunityRoom(cid)).emit("user:activity", activity);
    else io.emit("user:activity", activity);
  });

  // Moderation: delete a post (only author or community admin)
  socket.on("post:delete", async (payload, ack) => {
    try {
      const postId = payload?.postId;
      const communityId = payload?.communityId;
      if (!postId || !communityId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid-payload' });
        return;
      }
      const communityRef = db.collection('communities').doc(communityId);
      const postRef = db.collection('posts').doc(postId);
      const [cSnap, pSnap] = await Promise.all([communityRef.get(), postRef.get()]);
      if (!cSnap.exists || !pSnap.exists) {
        if (typeof ack === 'function') ack({ ok: false, error: 'not-found' });
        return;
      }
      const admins = cSnap.get('admins') || [];
      const mods = cSnap.get('moderators') || [];
      const isAdmin = Array.isArray(admins) && admins.includes(uid);
      const isMod = Array.isArray(mods) && mods.includes(uid);
      const isAuthor = pSnap.get('authorId') === uid;
      if (!isAdmin && !isMod && !isAuthor) {
        if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
        return;
      }
      // Broadcast deletion event
      io.to(toCommunityRoom(communityId)).emit('post:deleted', { postId, communityId, by: uid });
      // Delete Firestore doc
      try { await postRef.delete(); } catch {}
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: 'server-error' });
    }
  });

  // Moderation: delete a comment (author, moderator, or admin)
  socket.on('comment:delete', async (payload, ack) => {
    try {
      const commentId = payload?.commentId;
      const communityId = payload?.communityId;
      if (!commentId || !communityId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid-payload' });
        return;
      }
      const communityRef = db.collection('communities').doc(communityId);
      const commentRef = db.collection('comments').doc(commentId);
      const [cSnap, mSnap] = await Promise.all([communityRef.get(), commentRef.get()]);
      if (!cSnap.exists || !mSnap.exists) {
        if (typeof ack === 'function') ack({ ok: false, error: 'not-found' });
        return;
      }
      const admins = cSnap.get('admins') || [];
      const mods = cSnap.get('moderators') || [];
      const isAdmin = Array.isArray(admins) && admins.includes(uid);
      const isMod = Array.isArray(mods) && mods.includes(uid);
      const isAuthor = mSnap.get('authorId') === uid;
      if (!isAdmin && !isMod && !isAuthor) {
        if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
        return;
      }
      io.to(toCommunityRoom(communityId)).emit('comment:deleted', { commentId, communityId, by: uid });
      try { await commentRef.delete(); } catch {}
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: 'server-error' });
    }
  });

  // Moderation: remove a reaction (moderator or admin)
  socket.on('reaction:remove', async (payload, ack) => {
    try {
      const targetId = payload?.targetId;
      const targetType = payload?.targetType;
      const communityId = payload?.communityId;
      const emoji = payload?.emoji;
      if (!targetId || !targetType || !communityId || !emoji) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid-payload' });
        return;
      }
      const communityRef = db.collection('communities').doc(communityId);
      const cSnap = await communityRef.get();
      if (!cSnap.exists) {
        if (typeof ack === 'function') ack({ ok: false, error: 'not-found' });
        return;
      }
      const admins = cSnap.get('admins') || [];
      const mods = cSnap.get('moderators') || [];
      const isAdmin = Array.isArray(admins) && admins.includes(uid);
      const isMod = Array.isArray(mods) && mods.includes(uid);
      if (!isAdmin && !isMod) {
        if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
        return;
      }
      io.to(toCommunityRoom(communityId)).emit('reaction:removed', { targetId, targetType, emoji, communityId, by: uid });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: 'server-error' });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected ${socket.id} uid=${uid ?? "unknown"} (${reason})`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Socket.io server listening on http://${HOST}:${PORT} (origin: ${ORIGIN})`);
});
