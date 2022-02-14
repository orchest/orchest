import { useAsync } from "@/hooks/useAsync";
import type { EnvironmentBuild } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";

export const useRequestEnvironmentBuild = (url: string) => {
  const {
    data: newEnvironmentBuild,
    status,
    error: requestBuildError,
    run,
  } = useAsync<EnvironmentBuild>();
  const requestToBuild = React.useCallback(
    (project_uuid: string, environment_uuid: string) => {
      return run(
        fetcher<{ environment_builds: EnvironmentBuild[] }>(url, {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({
            environment_build_requests: [{ environment_uuid, project_uuid }],
          }),
        }).then((response) => response.environment_builds[0])
      );
    },
    [run, url]
  );

  const isRequestingToBuild = status === "PENDING";

  return {
    requestToBuild,
    isRequestingToBuild,
    newEnvironmentBuild,
    requestBuildError,
  };
};
