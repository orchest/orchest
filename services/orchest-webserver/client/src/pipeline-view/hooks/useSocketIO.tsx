import React from "react";
import io from "socket.io-client";

export type SocketIO = Record<"on" | "off" | "emit", any> & {
  disconnect: () => void;
};

export const useSocketIO = () => {
  const [sio, setSio] = React.useState<SocketIO>(null);
  // TODO: only make state.sio defined after successful
  // connect to avoid .emit()'ing to unconnected
  // sio client (emits aren't buffered).
  const connectSocketIO = () => {
    // disable polling
    setSio(io.connect("/pty", { transports: ["websocket"] }));
  };

  const disconnectSocketIO = () => {
    if (sio) sio.disconnect();
  };

  React.useEffect(() => {
    connectSocketIO();
    return () => disconnectSocketIO();
  }, []);

  return sio;
};
