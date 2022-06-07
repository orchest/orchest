import { NotificationSubscription } from "./notification-webhooks";

export const NOTIFICATION_END_POINT = "/catch/api-proxy/api/notifications";

export type EventForDisplay = "display:job-run-fails";

// In order to make the options easier to understand,
// events are grouped when being displayed.
// And the "virtual" events for display should be prefixed with "display:".
// When rendering and sending request, convert the data back & forth to corresponding strings.

export const displayEventMappings: Record<
  EventForDisplay,
  NotificationSubscription["event_type"][]
> = {
  "display:job-run-fails": [
    "project:one-off-job:pipeline-run:failed",
    "project:cron-job:run:pipeline-run:failed",
  ],
};

/**
 * Convert the above object to the following format:
 * ```
 * {
 *   "project:one-off-job:pipeline-run:failed": "display:job-run-fails",
 *   "project:cron-job:run:pipeline-run:failed": "display:job-run-fails",
 * };
 * ```
 */

export const eventExplanationMappings: Record<
  NotificationSubscription["event_type"],
  EventForDisplay
> = Object.entries(displayEventMappings).reduce(
  (obj, [eventForDisplay, events]) => {
    const convertedObject = (events as NotificationSubscription["event_type"][]).reduce(
      (value, eventType) => {
        return { ...value, [eventType]: eventForDisplay as EventForDisplay };
      },
      {} as Record<string, EventForDisplay>
    );
    return { ...obj, ...convertedObject };
  },
  {} as Record<NotificationSubscription["event_type"], EventForDisplay>
);
