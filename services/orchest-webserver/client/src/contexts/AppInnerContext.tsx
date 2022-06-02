import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import React from "react";

export type AppInnerContextType = {
  orchestVersion: string | null | undefined;
  checkUpdate: () => Promise<void>;
};

export const AppInnerContext = React.createContext<AppInnerContextType>(
  {} as AppInnerContextType
);

export const useAppInnerContext = () => React.useContext(AppInnerContext);

export const AppInnerContextProvider: React.FC = ({ children }) => {
  const { checkUpdate, orchestVersion } = useCheckUpdate();

  return (
    <AppInnerContext.Provider
      value={{
        checkUpdate,
        orchestVersion,
      }}
    >
      {children}
    </AppInnerContext.Provider>
  );
};
