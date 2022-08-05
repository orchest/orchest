import React from "react";
import io from "socket.io-client";

export const useSocketIO = (namespace: string) => {
  const socket = React.useMemo(
    () => io(namespace, { transports: ["websocket"] }),
    [namespace]
  );

  React.useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return socket;
};
