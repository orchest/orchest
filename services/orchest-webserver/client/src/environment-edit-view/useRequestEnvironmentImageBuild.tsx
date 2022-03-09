import { useAsync } from "@/hooks/useAsync";
import type { EnvironmentImageBuild } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";

export const useRequestEnvironmentImageBuild = (url: string) => {
  const {
    data: newEnvironmentImageBuild,
    status,
    error: requestBuildError,
    run,
  } = useAsync<EnvironmentImageBuild>();
  const requestToBuild = React.useCallback(
    (project_uuid: string, environment_uuid: string) => {
      return run(
        fetcher<{ environment_image_builds: EnvironmentImageBuild[] }>(url, {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({
            environment_image_build_requests: [
              { environment_uuid, project_uuid },
            ],
          }),
        }).then((response) => response.environment_image_builds[0])
      );
    },
    [run, url]
  );

  const isRequestingToBuild = status === "PENDING";

  return {
    requestToBuild,
    isRequestingToBuild,
    newEnvironmentImageBuild,
    requestBuildError,
  };
};
