import React from "react";
import io from "socket.io-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Socket = Record<"on" | "off" | "emit" | "close", any> & {
  connect: (namespace: string, params: Record<string, string[]>) => Socket;
  disconnect: () => void;
  close: () => void; // Synonym of socket.disconnect().
};

export const useSocketIO = (namespace: string) => {
  const socket = React.useMemo<Socket>(() => {
    return io.connect(namespace, { transports: ["websocket"] });
  }, [namespace]);

  React.useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return socket;
};
