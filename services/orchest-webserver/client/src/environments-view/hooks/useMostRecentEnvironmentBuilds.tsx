import { useInterval } from "@/hooks/use-interval";
import { useAsync } from "@/hooks/useAsync";
import { EnvironmentImageBuild } from "@/types";
import React from "react";
import { fetchMostRecentEnvironmentBuilds } from "../common";

export const useMostRecentEnvironmentBuilds = ({
  projectUuid,
  environmentUuid,
  refreshInterval,
}: {
  projectUuid: string | undefined;
  environmentUuid?: string | undefined;
  refreshInterval?: undefined | number;
}) => {
  const { run, data, error } = useAsync<EnvironmentImageBuild[]>();

  const sendRequest = React.useCallback(() => {
    if (!projectUuid) return Promise.reject();
    return run(fetchMostRecentEnvironmentBuilds(projectUuid, environmentUuid));
  }, [environmentUuid, projectUuid, run]);

  useInterval(sendRequest, refreshInterval);

  React.useEffect(() => {
    sendRequest();
  }, [sendRequest]);

  return {
    environmentBuilds: data,
    error,
  };
};
