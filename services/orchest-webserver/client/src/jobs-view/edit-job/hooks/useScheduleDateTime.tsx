import { useEditJob } from "@/jobs-view/stores/useEditJob";
import {
  convertUtcToLocalDate,
  getCurrentDateTimeString,
  toUtcDateTimeString,
} from "@/utils/date-time";
import React from "react";
import { useLoadValueFromJobChanges } from "./useLoadValueFromJobChanges";

export const useScheduleDateTime = () => {
  const [scheduledDateTimeString, setScheduledDateTimeString] = React.useState<
    string
  >();
  useLoadValueFromJobChanges(
    (jobChanges) =>
      jobChanges?.next_scheduled_time || getCurrentDateTimeString(),
    setScheduledDateTimeString
  );

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const setScheduledDateTime = React.useCallback(
    (dateTime: Date) => {
      const dateTimeString = toUtcDateTimeString(dateTime);
      setScheduledDateTimeString(dateTimeString);
      setJobChanges({
        schedule: undefined,
        next_scheduled_time: dateTimeString,
      });
    },
    [setJobChanges]
  );

  const scheduledDateTime = React.useMemo(() => {
    return scheduledDateTimeString
      ? convertUtcToLocalDate(scheduledDateTimeString)
      : new Date();
  }, [scheduledDateTimeString]);

  return [scheduledDateTime, setScheduledDateTime] as const;
};
