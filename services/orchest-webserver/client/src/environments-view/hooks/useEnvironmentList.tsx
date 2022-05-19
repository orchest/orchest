import { TStatus } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import React from "react";
import { BUILD_POLL_FREQUENCY } from "../common";
import { useMostRecentEnvironmentBuilds } from "./useMostRecentEnvironmentBuilds";

export const useEnvironmentList = (
  projectUuid: string | undefined,
  navigateToProject: () => void
) => {
  const { setAlert } = useAppContext();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedNavigateToProject = React.useCallback(navigateToProject, []);

  const {
    environments = [],
    isFetchingEnvironments,
    setEnvironments,
    error: fetchEnvironmentsError,
  } = useFetchEnvironments(projectUuid);

  React.useEffect(() => {
    if (fetchEnvironmentsError) {
      setAlert("Error", "Error fetching Environments");
      memoizedNavigateToProject();
    }
  }, [fetchEnvironmentsError, memoizedNavigateToProject, setAlert]);
  const {
    environmentBuilds = [],
    error: fetchBuildsError,
  } = useMostRecentEnvironmentBuilds({
    projectUuid,
    refreshInterval: BUILD_POLL_FREQUENCY,
  });

  React.useEffect(() => {
    if (fetchBuildsError)
      setAlert(
        "Error",
        "Failed to fetch the latests build of the environment."
      );
  }, [fetchBuildsError, setAlert]);

  const environmentRows = React.useMemo(() => {
    const statusObject = environmentBuilds.reduce((obj, build) => {
      return {
        ...obj,
        [`${build.project_uuid}-${build.environment_uuid}`]: build.status,
      };
    }, {} as Record<string, TStatus>);
    return environments.map((env) => ({
      ...env,
      status: statusObject[`${env.project_uuid}-${env.uuid}`] || "NOT BUILT",
    }));
  }, [environments, environmentBuilds]);

  return {
    environmentRows,
    environments,
    isFetchingEnvironments,
    setEnvironments,
  };
};
