import React from "react";
import { IntercomProvider } from "react-use-intercom";
import { useAppContext } from "./AppContext";

export const Intercom: React.FC = ({ children }) => {
  const { state } = useAppContext();

  return (
    <IntercomProvider appId={state.config?.INTERCOM_APP_ID || ""}>
      {children}
    </IntercomProvider>
  );
};
