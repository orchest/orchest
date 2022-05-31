import { StateDispatcher } from "@/hooks/useAsync";
import React from "react";
import {
  NotificationEventType,
  NotificationWebhookSubscriber,
} from "./notification-webhooks";
import { useFetchNotificationEventTypes } from "./useFetchNotificationEventTypes";
import { useFetchNotificationSubscribers } from "./useFetchNotificationSubscribers";

export type NotificationSettingsContextType = {
  webhooks: NotificationWebhookSubscriber[];
  setWebhooks: StateDispatcher<NotificationWebhookSubscriber[]>;
  fetchWebhooks: () => void | Promise<NotificationWebhookSubscriber[]>;
  notificationEventTypes: NotificationEventType[];
};

export const NotificationSettingsContext = React.createContext<
  NotificationSettingsContextType
>({} as NotificationSettingsContextType);

export const useNotificationSettingsContext = () =>
  React.useContext(NotificationSettingsContext);

export const NotificationSettingsContextProvider: React.FC = ({ children }) => {
  const { notificationEventTypes = [] } = useFetchNotificationEventTypes();
  const {
    subscribers: webhooks = [],
    setSubscribers: setWebhooks,
    fetchNotificationSubscribers: fetchWebhooks,
  } = useFetchNotificationSubscribers<NotificationWebhookSubscriber[]>(
    (subscribers) =>
      subscribers.filter(
        (subscriber): subscriber is NotificationWebhookSubscriber =>
          subscriber.type === "webhook"
      )
  );

  return (
    <NotificationSettingsContext.Provider
      value={{
        webhooks,
        setWebhooks,
        fetchWebhooks,
        notificationEventTypes,
      }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
};
