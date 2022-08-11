import { TStatus } from "@/components/Status";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import React from "react";
import { BUILD_POLL_FREQUENCY, requestToRemoveEnvironment } from "../common";
import { useMostRecentEnvironmentBuilds } from "./useMostRecentEnvironmentBuilds";

export const useEnvironmentListBase = (projectUuid: string | undefined) => {
  const {
    environments = [],
    isFetchingEnvironments,
    setEnvironments,
    error: fetchEnvironmentsError,
  } = useFetchEnvironments(projectUuid);

  const {
    environmentBuilds = [],
    error: fetchBuildsError,
  } = useMostRecentEnvironmentBuilds({
    projectUuid,
    refreshInterval: BUILD_POLL_FREQUENCY,
  });

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

  const doRemoveEnvironment = React.useCallback(
    async (environmentUuid: string) => {
      if (!projectUuid) return Promise.reject();
      await requestToRemoveEnvironment(projectUuid, environmentUuid);
      setEnvironments((current) =>
        current
          ? current.filter((current) => current.uuid !== environmentUuid)
          : current
      );
    },
    [projectUuid, setEnvironments]
  );

  return {
    environmentRows,
    environments,
    isFetchingEnvironments,
    fetchEnvironmentsError,
    fetchBuildsError,
    doRemoveEnvironment,
  };
};

export const useEnvironmentList = (
  projectUuid: string | undefined,
  navigateToProjects: () => void
) => {
  const { setAlert } = useGlobalContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedNavigateToProject = React.useCallback(navigateToProjects, []);

  const {
    fetchEnvironmentsError,
    fetchBuildsError,
    environmentRows,
    environments,
    isFetchingEnvironments,
    doRemoveEnvironment,
  } = useEnvironmentListBase(projectUuid);

  React.useEffect(() => {
    if (fetchEnvironmentsError) {
      setAlert("Error", "Error fetching Environments");
      memoizedNavigateToProject();
    }
  }, [fetchEnvironmentsError, memoizedNavigateToProject, setAlert]);

  React.useEffect(() => {
    if (fetchBuildsError)
      setAlert(
        "Error",
        "Failed to fetch the latests build of the environment."
      );
  }, [fetchBuildsError, setAlert]);

  return {
    environmentRows,
    environments,
    isFetchingEnvironments,
    doRemoveEnvironment,
  };
};
