import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useSelectEnvironmentUuid } from "../stores/useSelectEnvironmentUuid";
import { useGetEnvironments } from "./useGetEnvironments";

export const useSyncEnvironmentUuidWithQueryArgs = () => {
  const {
    projectUuid,
    environmentUuid: environmentUuidFromRoute,
    navigateTo,
  } = useCustomRoute();
  const { environmentUuid, setEnvironmentUuid } = useSelectEnvironmentUuid();
  const { environments } = useGetEnvironments();

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
};