import { useFetcher } from "@/hooks/useFetcher";
import { ContentType, HEADER, validURL } from "@orchest/lib-utils";
import React from "react";
import { NOTIFICATION_END_POINT } from "../common";

export const useVerifyWebhookUrl = (contentType: ContentType) => {
  const [webhookUrl, setWebhookUrl] = React.useState("");

  const { data = false, status, fetchData, error } = useFetcher(
    validURL(webhookUrl, true)
      ? `${NOTIFICATION_END_POINT}/subscribers/test-ping-before-creation`
      : undefined,
    {
      transform: () => true,
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        url: webhookUrl,
        content_type: contentType,
        payload: JSON.stringify({
          text: `A testing notification from Orchest at ${new Date().toUTCString()}`,
        }),
      }),
      disableFetchOnMount: true,
    }
  );

  const isSslAllowed = React.useMemo(() => {
    return webhookUrl.startsWith("https");
  }, [webhookUrl]);

  return {
    webhookUrl,
    setWebhookUrl,
    isUrlVerified: data,
    verifyUrl: fetchData,
    status,
    error,
    isSslAllowed,
  };
};
