import { useFetcher } from "@/hooks/useFetcher";
import React from "react";
import {
  eventExplanationMappings,
  EventForDisplay,
  NOTIFICATION_END_POINT,
} from "./common";
import { NotificationEventType } from "./notification-webhooks";
import { useFetchSubscribedEventTypes } from "./useFetchSubscribedEventTypes";

export const useFetchNotificationEventTypes = (
  webhookUuid: string | undefined
) => {
  const { data: notificationEventTypes } = useFetcher<
    { events: NotificationEventType[] },
    EventForDisplay[]
  >(`${NOTIFICATION_END_POINT}/subscribable-events`, {
    transform: (response) =>
      response.events
        .filter((event) =>
          /^project:.*\:pipeline-run\:failed$/.test(event.name)
        )
        .reduce((allDisplayedEvents, event) => {
          const eventForDisplay = eventExplanationMappings[event.name];
          if (
            !eventForDisplay ||
            allDisplayedEvents.includes(eventForDisplay)
          ) {
            return allDisplayedEvents;
          }
          return [...allDisplayedEvents, eventForDisplay];
        }, [] as EventForDisplay[]),
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
