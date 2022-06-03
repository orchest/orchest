import { useAppInnerContext } from "@/contexts/AppInnerContext";
import { StateDispatcher } from "@/hooks/useAsync";
import React from "react";
import { NotificationSubscription } from "./notification-webhooks";
import { useFetchNotificationEventTypes } from "./useFetchNotificationEventTypes";

export type NotificationSettingsContextType = {
  notificationEventTypes: NotificationSubscription["event_type"][];
  enabledEventTypes: NotificationSubscription["event_type"][];
  setEnabledEventTypes: StateDispatcher<
    NotificationSubscription["event_type"][]
  >;
};

export const NotificationSettingsContext = React.createContext<
  NotificationSettingsContextType
>({} as NotificationSettingsContextType);

export const useNotificationSettingsContext = () =>
  React.useContext(NotificationSettingsContext);

export const NotificationSettingsContextProvider: React.FC = ({ children }) => {
  const { webhooks } = useAppInnerContext();
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
