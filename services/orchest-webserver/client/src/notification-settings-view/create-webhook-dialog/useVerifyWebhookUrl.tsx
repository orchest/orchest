import { useFetcher } from "@/hooks/useFetcher";
import { ContentType, validURL } from "@orchest/lib-utils";
import React from "react";

const generateRequestBody = (
  body: Record<string, string>,
  contentType: ContentType
) => {
  if (contentType === "application/x-www-form-urlencoded")
    return new URLSearchParams(body);
  if (contentType === "application/json") return JSON.stringify(body);
  console.error("Unsupported content type.");
};

export const useVerifyWebhookUrl = (contentType: ContentType) => {
  const [webhookUrl, setWebhookUrl] = React.useState("");

  const { data = false, status, fetchData, error } = useFetcher(
    validURL(webhookUrl, true) ? webhookUrl : undefined,
    {
      transform: () => true,
      method: "POST",
      headers: { "Content-Type": contentType },
      // Normally notification is only sent by BE. This testing is temporarily done on FE. It's okay to set "no-cors"
      mode: "no-cors",
      body: generateRequestBody(
        { text: "A testing notification from Orchest" },
        contentType
      ),
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
