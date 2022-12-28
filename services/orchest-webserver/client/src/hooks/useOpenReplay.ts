import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import OpenReplay from "@openreplay/tracker";
import React from "react";

export const useOpenReplay = () => {
  const config = useOrchestConfigsApi((state) => state.config);

  React.useEffect(() => {
    if (!config) return;
    if (config.CLOUD === true) {
      const tracker = new OpenReplay({
        projectKey: config.OPENREPLAY_PROJECT_KEY,
        ingestPoint: config.OPENREPLAY_INGEST_POINT,
        obscureTextEmails: true,
        obscureTextNumbers: true,
        obscureInputEmails: true,
        defaultInputMode: 1,
      });
      tracker.start();
    }
  }, [config]);
};
