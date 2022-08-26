import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { findEnvironment } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";
import { useSelectEnvironmentUuid } from "../stores/useSelectEnvironmentUuid";

/**
 * Performs a side effect that ensures that the stores load the right environment
 * with the given environment_uuid in the query args.
 */
export const useSyncEnvironmentUuidWithQueryArgs = () => {
  const {
    projectUuid,
    environmentUuid: environmentUuidFromRoute,
    navigateTo,
  } = useCustomRoute();
  const { environmentUuid, setEnvironmentUuid } = useSelectEnvironmentUuid();
  const environments = useEnvironmentsApi((state) => state.environments);

  const targetEnvironmentUuid = React.useMemo(() => {
    const foundEnvironment =
      environments?.find((env) => env.uuid === environmentUuidFromRoute) ||
      environments?.[0];

    return foundEnvironment?.uuid;
  }, [environments, environmentUuidFromRoute]);

  const redirect = React.useCallback(
    (environmentUuid: string) => {
      navigateTo(siteMap.environments.path, {
        query: { projectUuid, environmentUuid },
      });
    },
    [navigateTo, projectUuid]
  );

  const isEnvironmentUuidFromRouteInvalid =
    targetEnvironmentUuid && targetEnvironmentUuid !== environmentUuidFromRoute;

  const shouldUpdateEnvironmentUuid =
    targetEnvironmentUuid && environmentUuid !== targetEnvironmentUuid;

  React.useEffect(() => {
    if (isEnvironmentUuidFromRouteInvalid) {
      redirect(targetEnvironmentUuid);
    } else if (shouldUpdateEnvironmentUuid) {
      setEnvironmentUuid(targetEnvironmentUuid);
    }
  }, [
    isEnvironmentUuidFromRouteInvalid,
    redirect,
    targetEnvironmentUuid,
    shouldUpdateEnvironmentUuid,
    setEnvironmentUuid,
  ]);

  const environmentChanges = React.useMemo(() => {
    return environmentUuid
      ? findEnvironment(environments, environmentUuid)
      : undefined;
  }, [environments, environmentUuid]);

  const initEnvironmentChanges = useEditEnvironment(
    (state) => state.initEnvironmentChanges
  );

  React.useEffect(() => {
    if (environmentChanges) initEnvironmentChanges(environmentChanges);
  }, [environmentChanges, initEnvironmentChanges]);
};
