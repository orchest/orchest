import React from "react";
import { IntercomProvider } from "react-use-intercom";
import { useAppContext } from "./AppContext";

export const Intercom: React.FC = ({ children }) => {
  const { config } = useAppContext();

  return (
    <IntercomProvider appId={config?.INTERCOM_APP_ID || ""}>
      {children}
    </IntercomProvider>
  );
};
