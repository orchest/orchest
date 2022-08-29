import React from "react";
import { useLoadValueFromJobChanges } from "./useLoadValueFromJobChanges";

const DEFAULT_CRON_STRING = "* * * * *";

export const useCronString = () => {
  const [cronString = "", setCronString] = React.useState<string | undefined>();
  useLoadValueFromJobChanges(
    (jobChanges) => jobChanges?.schedule || DEFAULT_CRON_STRING,
    setCronString
  );

  return [cronString, setCronString] as const;
};
