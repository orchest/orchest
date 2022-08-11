import { useAppContext } from "@/contexts/AppContext";
import { StateDispatcher } from "@/hooks/useAsync";
import React from "react";
import { EventForDisplay } from "./common";
import { useFetchNotificationEventTypes } from "./useFetchNotificationEventTypes";

export type NotificationSettingsContextType = {
  notificationEventTypes: EventForDisplay[];
  enabledEventTypes: EventForDisplay[];
  setEnabledEventTypes: StateDispatcher<EventForDisplay[]>;
};

export const NotificationSettingsContext = React.createContext<
  NotificationSettingsContextType
>({} as NotificationSettingsContextType);

export const useNotificationSettingsContext = () =>
  React.useContext(NotificationSettingsContext);

export const NotificationSettingsContextProvider: React.FC = ({ children }) => {
  const { webhooks } = useAppContext();
  const {
    notificationEventTypes = [],
    enabledEventTypes = [],
    setEnabledEventTypes,
  } = useFetchNotificationEventTypes(webhooks[0]?.uuid);

  return (
    <NotificationSettingsContext.Provider
      value={{
        notificationEventTypes,
        enabledEventTypes,
        setEnabledEventTypes,
      }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
};
