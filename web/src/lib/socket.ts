import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined;

let socket: Socket | null = null;

export function hasSocketConfig(): boolean {
  return Boolean(SOCKET_URL);
}

export function getSocket(): Socket {
  if (!socket) {
    const url = SOCKET_URL ?? "http://localhost:4000";
    // Only auto-connect if a URL is explicitly configured via env.
    // This prevents noisy websocket handshake errors when no server is running.
    const shouldAutoConnect = Boolean(SOCKET_URL);

    if (!shouldAutoConnect) {
      console.info("Socket.io: VITE_SOCKET_URL not set; client will not auto-connect.");
    }

    socket = io(url, {
      autoConnect: shouldAutoConnect,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
  }
  return socket;
}

// Manually connect when your Socket.io server is ready
export function connectSocket(force = false) {
  if (!force && !hasSocketConfig()) {
    console.info("Socket.io: Skipping connect; VITE_SOCKET_URL is not set.");
    return;
  }
  const s = getSocket();
  if (!s.connected) s.connect();
}

// Connect with Firebase ID token
export function connectSocketWithToken(token: string) {
  if (!hasSocketConfig()) {
    console.info("Socket.io: VITE_SOCKET_URL not set; cannot connect with token.");
    return;
  }
  const s = getSocket();
  // socket.io v4 auth payload
  (s as any).auth = { token };
  if (!s.connected) s.connect();
}

export function onConnect(cb: () => void) {
  getSocket().on("connect", cb);
}

export function onDisconnect(cb: (reason: string) => void) {
  getSocket().on("disconnect", cb);
}

export function joinCommunity(communityId: string) {
  getSocket().emit("room:join", communityId);
}

export function joinCommunityAck(communityId: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit("room:join", communityId, (res: any) => {
      if (res && typeof res.ok === "boolean") return resolve(res);
      resolve({ ok: false, error: "no-ack" });
    });
  });
}

export function leaveCommunity(communityId: string) {
  getSocket().emit("room:leave", communityId);
}

export function onNewPost(cb: (post: any) => void) {
  getSocket().on("post:new", cb);
}

export function onNewComment(cb: (comment: any) => void) {
  getSocket().on("comment:new", cb);
}

// Keep backward compatibility
export const onPostNew = onNewPost;
export const onCommentNew = onNewComment;

export function emit(event: string, payload?: unknown) {
  getSocket().emit(event, payload);
}

// Moderation helpers: posts
export function emitPostDelete(payload: { postId: string; communityId: string }): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit('post:delete', payload, (res: any) => {
      if (res && typeof res.ok === 'boolean') return resolve(res)
      resolve({ ok: false, error: 'no-ack' })
    })
  })
}
export function onPostDeleted(cb: (data: { postId: string; communityId: string; by: string }) => void) {
  getSocket().on('post:deleted', cb)
}
export function offPostDeleted(cb: (data: { postId: string; communityId: string; by: string }) => void) {
  getSocket().off('post:deleted', cb)
}

// Moderation helpers: comments
export function emitCommentDelete(payload: { commentId: string; communityId: string }): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit('comment:delete', payload, (res: any) => {
      if (res && typeof res.ok === 'boolean') return resolve(res)
      resolve({ ok: false, error: 'no-ack' })
    })
  })
}
export function onCommentDeleted(cb: (data: { commentId: string; communityId: string; by: string }) => void) {
  getSocket().on('comment:deleted', cb)
}
export function offCommentDeleted(cb: (data: { commentId: string; communityId: string; by: string }) => void) {
  getSocket().off('comment:deleted', cb)
}

// Moderation helpers: reactions
export function emitReactionRemove(payload: { targetId: string; targetType: 'post' | 'comment'; emoji: string; communityId: string }): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit('reaction:remove', payload, (res: any) => {
      if (res && typeof res.ok === 'boolean') return resolve(res)
      resolve({ ok: false, error: 'no-ack' })
    })
  })
}
export function onReactionRemoved(cb: (data: { targetId: string; targetType: 'post' | 'comment'; emoji: string; communityId: string; by: string }) => void) {
  getSocket().on('reaction:removed', cb)
}
export function offReactionRemoved(cb: (data: { targetId: string; targetType: 'post' | 'comment'; emoji: string; communityId: string; by: string }) => void) {
  getSocket().off('reaction:removed', cb)
}

// Post and comment events
export function emitNewPost(post: any) {
  getSocket().emit('post:new', post)
}

export function emitNewComment(comment: any) {
  getSocket().emit('comment:new', comment)
}

// Voting events
export function emitVote(voteData: {
  targetId: string;
  targetType: 'post' | 'comment';
  userId: string;
  voteType: 'up' | 'down' | null;
  newScore: number;
  communityId?: string;
}) {
  getSocket().emit('vote:update', voteData)
}

export function onVoteUpdate(callback: (voteData: any) => void) {
  getSocket().on('vote:update', callback)
}

// Reaction events
export function emitReaction(reactionData: {
  targetId: string;
  targetType: 'post' | 'comment';
  userId: string;
  emoji: string;
  action: 'add' | 'remove';
  communityId?: string;
}) {
  getSocket().emit('reaction:update', reactionData)
}

export function onReactionUpdate(callback: (reactionData: any) => void) {
  getSocket().on('reaction:update', callback)
}

// Off helpers for cleanup
export function offNewPost(cb: (post: any) => void) {
  getSocket().off('post:new', cb)
}
export function offNewComment(cb: (comment: any) => void) {
  getSocket().off('comment:new', cb)
}
export function offVoteUpdate(callback: (voteData: any) => void) {
  getSocket().off('vote:update', callback)
}
export function offReactionUpdate(callback: (reactionData: any) => void) {
  getSocket().off('reaction:update', callback)
}
export function offNewPoll(callback: (poll: any) => void) {
  getSocket().off('poll:new', callback)
}
export function offPollVote(callback: (voteData: any) => void) {
  getSocket().off('poll:vote', callback)
}

// Room-level errors (e.g., join denied)
export function onRoomError(callback: (err: any) => void) {
  getSocket().on('room:error', callback)
}
export function offRoomError(callback: (err: any) => void) {
  getSocket().off('room:error', callback)
}

// Poll events
export function emitPoll(pollData: any) {
  getSocket().emit('poll:new', pollData)
}

export function emitPollVote(voteData: {
  pollId: string;
  userId: string;
  optionId: string;
  communityId?: string;
}) {
  getSocket().emit('poll:vote', voteData)
}

export function onNewPoll(callback: (poll: any) => void) {
  getSocket().on('poll:new', callback)
}

export function onPollVote(callback: (voteData: any) => void) {
  getSocket().on('poll:vote', callback)
}

// User activity events
export function onUserActivity(callback: (activity: any) => void) {
  getSocket().on('user:activity', callback)
}

// Cleanup function
export function removeAllListeners() {
  const s = getSocket()
  s.off('post:new')
  s.off('comment:new')
  s.off('vote:update')
  s.off('reaction:update')
  s.off('poll:new')
  s.off('poll:vote')
  s.off('user:activity')
}

export function disconnectSocket() {
  try {
    removeAllListeners();
    const s = getSocket();
    if (s.connected) s.disconnect();
  } catch {}
}
