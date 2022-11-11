import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Performs a side effect that ensures that the stores load the right environment
 * with the given environment_uuid in the query args.
 */
export const useSyncEnvironmentUuidWithQueryArgs = () => {
  const { projectUuid, environmentUuid, navigateTo } = useCustomRoute();

  const targetEnvironment = useEnvironmentsApi(
    (state) => {
      if (projectUuid !== state.projectUuid) return undefined;
      const environment =
        state.environments?.find((env) => env.uuid === environmentUuid) ||
        state.environments?.[0];

      return environment;
    },
    (prev, curr) => prev?.uuid === curr?.uuid
  );

  const redirect = React.useCallback(
    (environmentUuid: string) => {
      navigateTo(siteMap.environments.path, {
        query: { projectUuid, environmentUuid },
      });
    },
    [navigateTo, projectUuid]
  );

  const isEnvironmentUuidFromRouteInvalid =
    targetEnvironment && targetEnvironment.uuid !== environmentUuid;

  const init = useEditEnvironment((state) => state.init);

  React.useEffect(() => {
    if (isEnvironmentUuidFromRouteInvalid) {
      redirect(targetEnvironment.uuid);
    } else if (targetEnvironment) {
      init(targetEnvironment);
    }

    return () => init(undefined);
  }, [isEnvironmentUuidFromRouteInvalid, redirect, targetEnvironment, init]);
};
