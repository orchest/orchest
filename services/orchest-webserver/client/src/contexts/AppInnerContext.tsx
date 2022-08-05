import { StateDispatcher } from "@/hooks/useAsync";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { NotificationWebhookSubscriber } from "@/notification-settings-view/notification-webhooks";
import { useFetchNotificationSubscribers } from "@/notification-settings-view/useFetchNotificationSubscribers";
import React from "react";
import { useAutoFetchPipelines } from "./useAutoFetchPipelines";

export type AppInnerContextType = {
  orchestVersion: string | null | undefined;
  checkUpdate: () => Promise<void>;
  webhooks: NotificationWebhookSubscriber[];
  setWebhooks: StateDispatcher<NotificationWebhookSubscriber[]>;
  fetchWebhooks: () => void | Promise<void | NotificationWebhookSubscriber[]>;
};

export const AppInnerContext = React.createContext<AppInnerContextType>(
  {} as AppInnerContextType
);

export const useAppInnerContext = () => React.useContext(AppInnerContext);

export const AppInnerContextProvider: React.FC = ({ children }) => {
  const { checkUpdate, orchestVersion } = useCheckUpdate();
  const {
    subscribers: webhooks = [],
    setSubscribers: setWebhooks,
    fetchNotificationSubscribers: fetchWebhooks,
  } = useFetchNotificationSubscribers<NotificationWebhookSubscriber[]>(
    (subscribers) => {
      return subscribers.filter(
        (subscriber): subscriber is NotificationWebhookSubscriber =>
          subscriber.type === "webhook"
      );
    }
  );

  // This hook has to stay in a context,
  // otherwise, it will fire unwanted requests when component mounts.
  // And it cannot reside in ProjectsContext because it requires useCustomRoute.
  useAutoFetchPipelines();

  return (
    <AppInnerContext.Provider
      value={{
        checkUpdate,
        orchestVersion,
        webhooks,
        setWebhooks,
        fetchWebhooks,
      }}
    >
      {children}
    </AppInnerContext.Provider>
  );
};
