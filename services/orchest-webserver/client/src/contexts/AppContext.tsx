import { useInitiateEnvironments } from "@/environments-view/hooks/useInitiateEnvironments";
import { StateDispatcher } from "@/hooks/useAsync";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { useInitiateJobs } from "@/jobs-view/hooks/useInitiateJobs";
import { NotificationWebhookSubscriber } from "@/notification-settings-view/notification-webhooks";
import { useFetchNotificationSubscribers } from "@/notification-settings-view/useFetchNotificationSubscribers";
import React from "react";
import { useAutoFetchPipelines } from "./useAutoFetchPipelines";

export type AppContextType = {
  orchestVersion: string | undefined;
  fetchOrchestVersion: () => Promise<string | void>;
  checkUpdate: () => Promise<void>;
  webhooks: NotificationWebhookSubscriber[];
  setWebhooks: StateDispatcher<NotificationWebhookSubscriber[]>;
  fetchWebhooks: () => void | Promise<void | NotificationWebhookSubscriber[]>;
};

export const AppContext = React.createContext<AppContextType>(
  {} as AppContextType
);

export const useAppContext = () => React.useContext(AppContext);

export const AppContextProvider: React.FC = ({ children }) => {
  const { checkUpdate, fetchOrchestVersion, orchestVersion } = useCheckUpdate();
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

  useAutoFetchPipelines();
  useInitiateEnvironments();
  useInitiateJobs();

  return (
    <AppContext.Provider
      value={{
        checkUpdate,
        orchestVersion,
        fetchOrchestVersion,
        webhooks,
        setWebhooks,
        fetchWebhooks,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
