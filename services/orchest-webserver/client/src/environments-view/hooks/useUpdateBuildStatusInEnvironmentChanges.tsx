import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Watch the changes of the latest build state and update environmentChanges accordingly.
 * Note: should only be used once in a view.
 */
export const useUpdateBuildStatusInEnvironmentChanges = () => {
  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const latestBuild = useEnvironmentsApi(
    (state) =>
      state.environments?.find((env) => env.uuid === uuid)?.latestBuild,
    (prev, curr) => prev?.status === curr?.status
  );

  const setEnvironmentChanges = useEditEnvironment(
    (state) => state.setEnvironmentChanges
  );

  React.useEffect(() => {
    if (latestBuild) {
      setEnvironmentChanges({ latestBuild });
    }
  }, [setEnvironmentChanges, latestBuild]);
};
