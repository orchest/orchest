import React from "react";
import { io, Socket } from "socket.io-client";
import create from "zustand";

type SocketIO = {
  sockets: Record<string, Socket>;
  init: (namespace: string | undefined) => void;
  disconnect: (namespace: string | undefined) => void;
};

const useSocketIOStore = create<SocketIO>((set) => ({
  sockets: {},
  init: (namespace) => {
    if (!namespace) return;
    set((state) => {
      const currentSocket = state.sockets[namespace];
      if (currentSocket) return {};
      // Socket, by default, will attempt to connect automatically upon creation.
      // Therefore, no need to call `socket.connect(...)` manually.
      const socket = io(namespace, {
        transports: ["websocket"],
        upgrade: false,
        reconnection: false, // Prevent automatically attempting to reconnect when being disconnected.
        closeOnBeforeunload: true,
      });
      return { sockets: { ...state.sockets, [namespace]: socket } };
    });
  },
  disconnect: (namespace) => {
    if (!namespace) return;
    set((state) => {
      const { [namespace]: socket, ...sockets } = state.sockets;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      return { sockets };
    });
  },
}));

export const useSocketIO = (namespace: string | undefined) => {
  const init = useSocketIOStore((state) => state.init);
  const disconnect = useSocketIOStore((state) => state.disconnect);
  const socket = useSocketIOStore((state) =>
    namespace ? state.sockets[namespace] : undefined
  );

  React.useEffect(() => {
    init(namespace);
    return () => disconnect(namespace);
  }, [init, namespace, disconnect]);

  return socket;
};
