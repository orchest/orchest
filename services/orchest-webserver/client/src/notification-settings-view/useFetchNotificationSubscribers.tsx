import { useFetcher } from "@/hooks/useFetcher";
import { NOTIFICATION_END_POINT } from "./common";
import { NotificationSubscriber } from "./notification-webhooks";

export const useFetchNotificationSubscribers = <T,>(
  transform: (value: NotificationSubscriber[]) => T = (value) =>
    (value as unknown) as T
) => {
  const { data, setData, status, fetchData } = useFetcher<
    { subscribers: NotificationSubscriber[] },
    T
  >(`${NOTIFICATION_END_POINT}/subscribers`, {
    transform: (response) => transform(response.subscribers),
  });

  return {
    subscribers: data,
    setSubscribers: setData,
    status,
    fetchNotificationSubscribers: fetchData,
  };
};
