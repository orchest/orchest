import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useInterval } from "@/hooks/useInterval";
import { useValidQueryArgs } from "@/hooks/useValidQueryArgs";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/**
 * Fetches the latest environment image builds by polling.
 * Returns the latest environmentImageBuild of the given environment UUID.
 */
export const useFetchBuildStatus = (environmentUuid: string | undefined) => {
  const projectUuid = useEnvironmentsApi((state) => state.projectUuid);
  const { projectUuid: validProjectUuid } = useValidQueryArgs({ projectUuid });
  const isStoreLoaded = useEnvironmentsApi(
    (state) => hasValue(validProjectUuid) && hasValue(state.environments)
  );

  const updateBuildStatus = useEnvironmentsApi(
    (state) => state.updateBuildStatus
  );

  React.useEffect(() => {
    if (isStoreLoaded) updateBuildStatus();
  }, [isStoreLoaded, updateBuildStatus]);

  const environmentImageBuild = useEnvironmentsApi((state) =>
    !isStoreLoaded
      ? undefined
      : state.environments?.find((env) => env.uuid === environmentUuid)
          ?.latestBuild
  );

  const isBuilding =
    environmentImageBuild &&
    ["PENDING", "STARTED"].includes(environmentImageBuild.status);

  useInterval(
    updateBuildStatus,
    !isStoreLoaded ? undefined : isBuilding ? 1000 : 5000
  );

  const hasLoadedBuildStatus = useEnvironmentsApi(
    (state) => state.hasLoadedBuildStatus
  );

  return { environmentImageBuild, isBuilding, hasLoadedBuildStatus };
};
