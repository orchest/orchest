import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Watch the changes of the latest build state and update environmentChanges accordingly.
 * Note: should only be used once in a view.
 */
export const useUpdateBuildStatusInEnvironmentChanges = () => {
  const environments = useEnvironmentsApi((state) => state.environments);
  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const setEnvironmentChanges = useEditEnvironment(
    (state) => state.setEnvironmentChanges
  );

  const environmentChangesFromStore = React.useMemo(
    () => environments?.find((env) => env.uuid === uuid),
    [environments, uuid]
  );

  const latestBuildStatus = React.useMemo(() => {
    return environmentChangesFromStore?.latestBuild?.status;
  }, [environmentChangesFromStore?.latestBuild?.status]);

  React.useEffect(() => {
    if (latestBuildStatus) {
      setEnvironmentChanges({
        latestBuild: environmentChangesFromStore?.latestBuild,
      });
    }
    // `environmentChangesFromStore` is updated too frequently, as we only want to update when status is changed.
  }, [setEnvironmentChanges, latestBuildStatus]); // eslint-disable-line react-hooks/exhaustive-deps
};
