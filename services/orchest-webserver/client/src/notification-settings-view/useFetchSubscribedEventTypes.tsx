import { useFetcher } from "@/hooks/useFetcher";
import {
  eventExplanationMappings,
  EventForDisplay,
  NOTIFICATION_END_POINT,
} from "./common";
import { NotificationWebhookSubscriberWithSubscription } from "./notification-webhooks";

export const useFetchSubscribedEventTypes = (uuid: string | undefined) => {
  const { data, setData, status } = useFetcher<
    NotificationWebhookSubscriberWithSubscription,
    EventForDisplay[]
  >(uuid ? `${NOTIFICATION_END_POINT}/subscribers/${uuid}` : undefined, {
    transform: (data) => {
      return data.subscriptions.reduce((eventsForDisplay, subscription) => {
        const eventForDisplay =
          eventExplanationMappings[subscription.event_type];
        if (!eventForDisplay || eventsForDisplay.includes(eventForDisplay))
          return eventsForDisplay;
        return [...eventsForDisplay, eventForDisplay];
      }, [] as EventForDisplay[]);
    },
  });

  return {
    enabledEventTypes: data,
    setEnabledEventTypes: setData,
    status,
  };
};
