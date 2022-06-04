import { useFetcher } from "@/hooks/useFetcher";
import React from "react";
import { NOTIFICATION_END_POINT } from "./common";
import {
  NotificationEventType,
  NotificationSubscription,
} from "./notification-webhooks";
import { useFetchSubscribedEventTypes } from "./useFetchSubscribedEventTypes";

export const useFetchNotificationEventTypes = (
  webhookUuid: string | undefined
) => {
  const { data: notificationEventTypes } = useFetcher<
    { events: NotificationEventType[] },
    NotificationSubscription["event_type"][]
  >(`${NOTIFICATION_END_POINT}/subscribable-events`, {
    transform: (response) =>
      response.events
        .filter(
          // TODO: expose other event types when PUT endpoint is implemented.
          (event) => /^project:.*\:failed$/.test(event.name)
        )
        .map((event) => event.name),
  });

  const {
    enabledEventTypes,
    setEnabledEventTypes,
  } = useFetchSubscribedEventTypes(webhookUuid);

  // If user does not have any webhook yet, default all job-related events.
  // This could also happen when user delete all existing webhooks.
  React.useEffect(() => {
    if (notificationEventTypes && !webhookUuid) {
      setEnabledEventTypes(notificationEventTypes);
    }
  }, [webhookUuid, notificationEventTypes, setEnabledEventTypes]);

  return {
    notificationEventTypes,
    enabledEventTypes,
    setEnabledEventTypes,
  };
};
