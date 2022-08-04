import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useInterval } from "@/hooks/use-interval";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetches the latest environment image builds by polling.
 * Returns the latest environmentImageBuild of the given environment UUID.
 */
export const useUpdateBuildStatus = (environmentUuid?: string) => {
  const {
    projectUuid,
    environments,
    updateBuildStatus,
    hasLoadedBuildStatus,
  } = useEnvironmentsApi();
  const isStoreLoaded = hasValue(projectUuid) && hasValue(environments);

  const initializeBuildStatus = React.useCallback(async () => {
    if (isStoreLoaded) await updateBuildStatus();
  }, [isStoreLoaded, updateBuildStatus]);

  const environmentImageBuild = React.useMemo(() => {
    if (!isStoreLoaded) return;
    const environment = environments.find(
      (env) => env.uuid === environmentUuid
    );
    return environment?.latestBuild;
  }, [isStoreLoaded, environments, environmentUuid]);

  React.useEffect(() => {
    initializeBuildStatus();
  }, [initializeBuildStatus]);

  const isBuilding =
    environmentImageBuild &&
    ["PENDING", "STARTED"].includes(environmentImageBuild.status);

  useInterval(
    updateBuildStatus,
    !isStoreLoaded ? undefined : isBuilding ? 1000 : 5000
  );

  return { environmentImageBuild, isBuilding, hasLoadedBuildStatus };
};
