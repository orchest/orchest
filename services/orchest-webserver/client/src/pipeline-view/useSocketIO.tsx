import React from "react";
import io from "socket.io-client";

export const useSocketIO = () => {
  const [sio, setSio] = React.useState<{ disconnect: () => void }>(null);
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
