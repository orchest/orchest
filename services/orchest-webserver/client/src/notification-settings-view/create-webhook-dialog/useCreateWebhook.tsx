import { useFetcher } from "@/hooks/useFetcher";
import { HEADER } from "@orchest/lib-utils";
import { NOTIFICATION_END_POINT } from "../common";
import {
  NotificationSubscriptionPayload,
  NotificationWebhookSubscriber,
} from "../notification-webhooks";

export type SubscriberPayload = Pick<
  NotificationWebhookSubscriber,
  "url" | "name" | "secret" | "verify_ssl" | "content_type"
> & {
  subscriptions: NotificationSubscriptionPayload[];
};

export const useCreateWebhook = (subscriber: SubscriberPayload) => {
  const { fetchData, status } = useFetcher<NotificationWebhookSubscriber>(
    `${NOTIFICATION_END_POINT}/subscribers/webhooks`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify(subscriber),
      disableFetchOnMount: true,
    }
  );

  return { createWebhook: fetchData, status };
};
