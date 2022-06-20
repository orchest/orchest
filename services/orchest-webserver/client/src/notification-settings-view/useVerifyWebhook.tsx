import { useFetcher } from "@/hooks/useFetcher";
import { NOTIFICATION_END_POINT } from "./common";

export const useVerifyWebhook = (subscriberUuid: string) => {
  const { data = false, status, fetchData } = useFetcher(
    subscriberUuid
      ? `${NOTIFICATION_END_POINT}/subscribers/test-ping-delivery/${subscriberUuid}`
      : undefined,
    { transform: () => true, disableFetchOnMount: true }
  );

  return {
    isVerified: data,
    verify: fetchData,
    status,
  };
};
