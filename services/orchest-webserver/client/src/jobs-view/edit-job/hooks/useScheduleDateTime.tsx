import {
  convertDateToDateTimeString,
  getCurrentDateTimeString,
} from "@/utils/date-time";
import React from "react";
import { useLoadValueFromJobChanges } from "./useLoadValueFromJobChanges";

export const useScheduleDateTime = () => {
  const [scheduledDateTimeString, setScheduledDateTimeString] = React.useState<
    string
  >("");
  useLoadValueFromJobChanges(
    (jobChanges) =>
      jobChanges?.next_scheduled_time || getCurrentDateTimeString(),
    setScheduledDateTimeString
  );

  const setScheduledDateTime = React.useCallback((dateTime: Date) => {
    const dateTimeString = convertDateToDateTimeString(dateTime);
    setScheduledDateTimeString(dateTimeString);
  }, []);

  const scheduledDateTime = React.useMemo(() => {
    return new Date(scheduledDateTimeString);
  }, [scheduledDateTimeString]);

  return [scheduledDateTime, setScheduledDateTime] as const;
};
