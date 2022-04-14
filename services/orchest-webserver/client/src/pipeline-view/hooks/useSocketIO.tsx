import React from "react";
import io from "socket.io-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SocketIO = Record<"on" | "off" | "emit", any> & {
  disconnect: () => void;
};

export const useSocketIO = () => {
  const sio = React.useMemo<SocketIO>(() => {
    return io.connect("/pty", { transports: ["websocket"] });
  }, []);

  React.useEffect(() => {
    return () => sio.disconnect();
  }, [sio]);

  return sio;
};
