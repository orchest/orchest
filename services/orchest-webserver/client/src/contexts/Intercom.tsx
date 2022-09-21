import React from "react";
import { IntercomProvider } from "react-use-intercom";
import { useGlobalContext } from "./GlobalContext";

export const Intercom: React.FC = ({ children }) => {
  const { config } = useGlobalContext();

  return (
    <IntercomProvider appId={config?.INTERCOM_APP_ID || ""}>
      {children}
    </IntercomProvider>
  );
};
