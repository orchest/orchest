import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useInterval } from "@/hooks/useInterval";
import { useValidQueryArgs } from "@/hooks/useValidQueryArgs";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetches the latest environment image builds by polling.
 * Returns the latest environmentImageBuild of the given environment UUID.
 */
export const useFetchBuildStatus = (environmentUuid?: string) => {
  const projectUuidInStore = useEnvironmentsApi((state) => state.projectUuid);
  const { projectUuid } = useValidQueryArgs({
    projectUuid: projectUuidInStore,
  });
  const environments = useEnvironmentsApi((state) => state.environments);
  const updateBuildStatus = useEnvironmentsApi(
    (state) => state.updateBuildStatus
  );
  const hasLoadedBuildStatus = useEnvironmentsApi(
    (state) => state.hasLoadedBuildStatus
  );

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
