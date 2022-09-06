import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { toUtcDateTimeString } from "@/utils/date-time";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useCronString } from "./useCronString";
import { useScheduleDateTime } from "./useScheduleDateTime";

export type ScheduleOption = "one-off" | "recurring";

export const useJobScheduleOption = () => {
  const { jobUuid } = useCustomRoute();

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "one-off"
  );
  const initialScheduleOption = useEditJob((state) => {
    const isLoading =
      !hasValue(state.jobChanges) || jobUuid !== state.jobChanges.uuid;

    return isLoading
      ? undefined
      : hasValue(state.jobChanges?.schedule)
      ? "recurring"
      : "one-off";
  });

  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (initialScheduleOption && !hasInitialized.current) {
      hasInitialized.current = true;
      setScheduleOption(initialScheduleOption);
    }
  }, [initialScheduleOption]);

  const [cronString, setCronString] = useCronString();
  const [nextScheduledTime, setNextScheduledTime] = useScheduleDateTime();

  React.useEffect(() => {
    if (scheduleOption === "one-off") {
      setJobChanges({
        next_scheduled_time: toUtcDateTimeString(nextScheduledTime),
        schedule: null,
      });
    }
    if (scheduleOption === "recurring") {
      setJobChanges({
        next_scheduled_time: null,
        schedule: cronString,
      });
    }
  }, [scheduleOption, setJobChanges, nextScheduledTime, cronString]);

  return {
    scheduleOption,
    setScheduleOption,
    cronString,
    setCronString,
    nextScheduledTime,
    setNextScheduledTime,
  };
};
