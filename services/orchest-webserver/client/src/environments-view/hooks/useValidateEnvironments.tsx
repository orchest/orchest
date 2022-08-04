import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useInterval } from "@/hooks/use-interval";
import React from "react";
import { BUILD_POLL_FREQUENCY } from "../common";

/**
 * Check if all environments are built. By default, it checks regularly periodically.
 * The exposed `validate` function can be used to check build status before
 * performing operations such as scheduling a job.
 */
export const useValidateEnvironments = (
  interval: number | null | undefined = BUILD_POLL_FREQUENCY
) => {
  const { projectUuid, validate, status } = useEnvironmentsApi();
  React.useEffect(() => {
    if (interval && projectUuid) validate();
  }, [interval, projectUuid, validate]);
  useInterval(validate, projectUuid ? interval : null);
  return { validate, status };
};
