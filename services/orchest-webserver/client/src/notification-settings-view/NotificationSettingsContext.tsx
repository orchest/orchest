import React from "react";
import { NotificationEventType } from "./notification-webhooks";
import { useFetchNotificationEventTypes } from "./useFetchNotificationEventTypes";

export type NotificationSettingsContextType = {
  notificationEventTypes: NotificationEventType[];
};

export const NotificationSettingsContext = React.createContext<
  NotificationSettingsContextType
>({} as NotificationSettingsContextType);

export const useNotificationSettingsContext = () =>
  React.useContext(NotificationSettingsContext);

export const NotificationSettingsContextProvider: React.FC = ({ children }) => {
  const { notificationEventTypes = [] } = useFetchNotificationEventTypes();

  return (
    <NotificationSettingsContext.Provider
      value={{
        notificationEventTypes,
      }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
};
