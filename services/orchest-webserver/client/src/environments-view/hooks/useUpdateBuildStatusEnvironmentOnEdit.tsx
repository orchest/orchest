import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

/**
 * Watch the changes of the latest build state and update environmentOnEdit accordingly.
 * Note: should only be used once in a view.
 */
export const useUpdateBuildStatusEnvironmentOnEdit = () => {
  const { environments } = useEnvironmentsApi();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  const environmentOnEditFromStore = React.useMemo(
    () => environments?.find((env) => env.uuid === environmentOnEdit?.uuid),
    [environments, environmentOnEdit?.uuid]
  );

  const latestBuildStatus = React.useMemo(() => {
    return environmentOnEditFromStore?.latestBuild?.status;
  }, [environmentOnEditFromStore?.latestBuild?.status]);

  React.useEffect(() => {
    if (latestBuildStatus) {
      setEnvironmentOnEdit({
        latestBuild: environmentOnEditFromStore?.latestBuild,
      });
    }
    // `environmentOnEditFromStore` is updated too frequently, as we only want to update when status is changed.
  }, [setEnvironmentOnEdit, latestBuildStatus]); // eslint-disable-line react-hooks/exhaustive-deps
};
