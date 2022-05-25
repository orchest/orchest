import { useFetcher } from "@/hooks/useFetcher";
import { NotificationEventType } from "./notification-webhooks";

export const useFetchNotificationEventTypes = () => {
  const { data, error } = useFetcher<
    { events: NotificationEventType[] },
    NotificationEventType[]
  >("/catch/api-proxy/api/notifications/subscribable-events", {
    // headers: HEADER.JSON,
    transform: (response) => response.events,
  });

  if (data) console.log("DEV data: ", data);
  if (error) console.log("DEV error: ", error);
};
