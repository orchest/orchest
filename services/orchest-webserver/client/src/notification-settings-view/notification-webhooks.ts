import { ContentType, fetcher } from "@orchest/lib-utils";
import { NOTIFICATION_END_POINT } from "./common";

type NotificationSubscription = {
  uuid: string;
  subscriber_uuid: string;
  event_type: string;
  project_uuid: string;
  job_uuid: string;
};

export type NotificationEventType = {
  name: NotificationSubscription["event_type"];
  optional_filters: ("project_uuid" | "job_uuid")[][];
};

export type NotificationSubscriptionPayload = Pick<
  NotificationSubscription,
  "event_type"
> &
  Partial<Pick<NotificationSubscription, "project_uuid" | "job_uuid">>;

type NotificationSubscriberBase = {
  uuid: string;
  subscriptions: NotificationSubscription[];
};

export type NotificationSubscriber =
  | (NotificationSubscriberBase & {
      type: "webhook";
      url: string;
      name: string;
      verify_ssl: boolean;
      content_type: ContentType;
      secret: string;
    })
  | (NotificationSubscriberBase & {
      type: "subscriber";
    });

export type NotificationWebhookSubscriber = Extract<
  NotificationSubscriber,
  { type: "webhook" }
>;

export const deleteSuscriber = (uuid: string) => {
  return fetcher<NotificationWebhookSubscriber>(
    `${NOTIFICATION_END_POINT}/subscribers/${uuid}`,
    { method: "DELETE" }
  );
};
