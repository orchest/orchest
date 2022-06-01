import { useFetcher } from "@/hooks/useFetcher";
import { NOTIFICATION_END_POINT } from "./common";
import { NotificationEventType } from "./notification-webhooks";

export const useFetchNotificationEventTypes = () => {
  const { data } = useFetcher<
    { events: NotificationEventType[] },
    NotificationEventType[]
  >(`${NOTIFICATION_END_POINT}/subscribable-events`, {
    transform: (response) =>
      response.events.filter(
        // TODO: expose other event types when PUT endpoint is implemented.
        (event) => /^project:.*\:failed$/.test(event.name)
      ),
  });

  return { notificationEventTypes: data };
};
