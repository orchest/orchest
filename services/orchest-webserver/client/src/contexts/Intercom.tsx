import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import React from "react";
import { IntercomProvider } from "react-use-intercom";

export const Intercom: React.FC = ({ children }) => {
  const appId = useOrchestConfigsApi(
    (state) => state.config?.INTERCOM_APP_ID || ""
  );
  return <IntercomProvider appId={appId}>{children}</IntercomProvider>;
};
