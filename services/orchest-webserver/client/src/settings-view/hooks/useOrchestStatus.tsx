import { fetcher } from "@orchest/lib-utils";
import React from "react";

export const useOrchestStatus = () => {
  const [status, setStatus] = React.useState<
    "..." | "online" | "offline" | "restarting"
  >("...");

  React.useEffect(() => {
    fetcher("/heartbeat")
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  return [status, setStatus] as const;
};
