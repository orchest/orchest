import { useFetcher } from "@/hooks/useFetcher";
import { HEADER } from "@orchest/lib-utils";
import { NOTIFICATION_END_POINT } from "../common";
import {
  NotificationWebhookSubscriber,
  WebhookSpec,
} from "../notification-webhooks";

export const useCreateWebhook = ({ url, ...subscriber }: WebhookSpec) => {
  const { fetchData, status } = useFetcher<NotificationWebhookSubscriber>(
    `${NOTIFICATION_END_POINT}/subscribers/webhooks`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({ url: url.trim(), ...subscriber }),
      disableFetchOnMount: true,
    }
  );

  return { createWebhook: fetchData, status };
};
