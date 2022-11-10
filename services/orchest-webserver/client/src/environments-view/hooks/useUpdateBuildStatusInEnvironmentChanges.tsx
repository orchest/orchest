import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { EnvironmentImageBuild } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Watch the changes of the latest build state and update environmentChanges accordingly.
 * Note: should only be used once in a view.
 */
export const useUpdateBuildStatusInEnvironmentChanges = () => {
  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const latestBuild = useEnvironmentsApi(
    (state) =>
      state.environments?.find((env) => env.uuid === uuid)?.latestBuild,
    isLatestBuildStatusUnchanged
  );

  const setEnvironmentChanges = useEditEnvironment((state) => state.update);

  React.useEffect(() => {
    setEnvironmentChanges({ latestBuild });
  }, [setEnvironmentChanges, latestBuild]);
};

const isLatestBuildStatusUnchanged = (
  prev: EnvironmentImageBuild | undefined,
  curr: EnvironmentImageBuild | undefined
) =>
  hasValue(prev) &&
  hasValue(curr) &&
  prev.project_uuid === curr.project_uuid &&
  prev.environment_uuid === curr.environment_uuid &&
  prev.status === curr.status;
