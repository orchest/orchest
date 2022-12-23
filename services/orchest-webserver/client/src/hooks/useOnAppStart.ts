import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { useInitIntercom } from "./useInitIntercom";
import { useInterval } from "./useInterval";
import { useOpenReplay } from "./useOpenReplay";

/** Initialize background services, such as Intercom and OpenReplay, on App start. */
export const useOnAppStart = () => {
  useOpenReplay();
  useInitIntercom();

  // Each client provides an heartbeat, used for telemetry and idle
  // checking.
  useInterval(() => {
    makeRequest("GET", "/heartbeat");
  }, 5000);

  const config = useOrchestConfigsApi((state) => state.config);
  React.useEffect(() => {
    if (config?.CLOUD === true) console.log("Orchest is running with --cloud.");
    if (config?.FLASK_ENV === "development")
      console.log("Orchest is running with --dev.");
  }, [config]);
};
