import { fetcher, HEADER } from "@orchest/lib-utils";

export type NotificationEventType = {
  name: string;
  optional_filters: string[][];
};

type NotificationSubscription = {
  uuid: string;
  subscriber_uuid: string;
  event_type: string;
  project_uuid: string;
  job_uuid: string;
};

type NotificationSubscriptionPayload = Partial<
  Omit<NotificationSubscription, "uuid" | "subscriber_uuid">
> & { event_type: string };

type NotificationWebhookResponse = {
  uuid: string;
  type: "webhook";
  subscriptions: NotificationSubscription[];
  url: string;
  name: string;
  verify_ssl: true;
  content_type: "application/json";
  secret: string;
};

export const createWebhook = (
  payload: Pick<NotificationWebhookResponse, "url" | "name" | "secret"> & {
    subscription: NotificationSubscriptionPayload[];
  }
) => {
  fetcher<NotificationWebhookResponse>(
    "/catch/api-proxy/api/notifications/subscribers/webhooks",
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        ...payload,
        verify_ssl: true,
        content_type: "application/json",
      }),
    }
  );
};
