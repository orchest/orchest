import { useFetcher } from "@/hooks/useFetcher";
import { NOTIFICATION_END_POINT } from "./common";
import {
  NotificationSubscription,
  NotificationWebhookSubscriberWithSubscription,
} from "./notification-webhooks";

export const useFetchSubscribedEventTypes = (uuid: string | undefined) => {
  const { data, setData, status } = useFetcher<
    NotificationWebhookSubscriberWithSubscription,
    NotificationSubscription["event_type"][]
  >(uuid ? `${NOTIFICATION_END_POINT}/subscribers/${uuid}` : undefined, {
    transform: (data) =>
      data.subscriptions.map((subscription) => subscription.event_type),
    caching: true, // enabledEventTypes should be persisted when uuid becomes undefined again.
  });

  return {
    enabledEventTypes: data,
    setEnabledEventTypes: setData,
    status,
  };
};
