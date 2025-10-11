import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL ?? "http://localhost:4000", {
      autoConnect: true,
      transports: ["websocket"],
      withCredentials: true,
    });
  }
  return socket;
}

export function onConnect(cb: () => void) {
  getSocket().on("connect", cb);
}

export function onDisconnect(cb: (reason: string) => void) {
  getSocket().on("disconnect", cb);
}

export function emit(event: string, payload?: unknown) {
  getSocket().emit(event, payload);
}