import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useInterval } from "@/hooks/use-interval";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useMounted } from "./useMounted";

const buildFailMessage = `Some environment builds of this project have failed. 
  You can try building them again, 
  but you might need to change the environment setup script in 
  order for the build to succeed.`;

const solutionMessages = {
  [BUILD_IMAGE_SOLUTION_VIEW.PIPELINE]:
    " You can cancel to view the pipeline in read-only mode.",
  [BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB]:
    " To start JupyterLab, all environments in the project need to be built.",
};

const getInactiveEnvironmentsMessage = (
  hasEnvironmentsToBuild: boolean,
  requestedFromView = ""
) => {
  const inactiveEnvironmentsMessage = hasEnvironmentsToBuild
    ? `Not all environments of this project have been built. Would you like to build them?`
    : `Some environments of this project are still building. Please wait until the build is complete.`;
  const solutionMessage = solutionMessages[requestedFromView] || "";

  return `${inactiveEnvironmentsMessage}${solutionMessage}`;
};

const usePollBuildStatus = () => {
  const { runUuid } = useCustomRoute();
  const { validate, status } = useEnvironmentsApi();

  const isJobRun = hasValue(runUuid);
  const {
    state: { buildRequest },
    dispatch,
  } = useProjectsContext();
  const checkAllEnvironmentsHaveBeenBuilt = React.useCallback(async () => {
    const result = await validate();
    if (!result) return;
    const [environmentValidationData, status] = result;
    setShouldPoll(status !== "allEnvironmentsBuilt");
    if (environmentValidationData?.validation === "pass") {
      buildRequest?.onComplete();
      dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
    }
  }, [validate, buildRequest, dispatch]);

  const isMounted = useMounted();
  const [shouldPoll, setShouldPoll] = React.useState(false);

  React.useEffect(() => {
    if (isMounted.current && !isJobRun) {
      setShouldPoll(status !== "allEnvironmentsBuilt");
    }
  }, [status, isMounted, isJobRun]);

  useInterval(
    checkAllEnvironmentsHaveBeenBuilt,
    isMounted.current && shouldPoll ? 1000 : null
  );

  React.useEffect(() => {
    checkAllEnvironmentsHaveBeenBuilt();
  }, [checkAllEnvironmentsHaveBeenBuilt]);

  return { setShouldPoll };
};

export const useBuildEnvironmentImages = () => {
  const { navigateTo } = useCustomRoute();

  const {
    state: { projectUuid, buildRequest },
    dispatch,
  } = useProjectsContext();

  const { validate, environmentsToBeBuilt, status } = useEnvironmentsApi();

  const cancel = React.useCallback(() => {
    buildRequest?.onCancel();
    dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
  }, [buildRequest, dispatch]);

  const isBuilding = status === "environmentsBuildInProgress";
  const buildHasFailed = status === "environmentsFailedToBuild";
  const allowBuild = [
    "environmentsFailedToBuild",
    "environmentsNotYetBuilt",
  ].includes(status);

  const message = buildHasFailed
    ? buildFailMessage
    : getInactiveEnvironmentsMessage(
        allowBuild,
        buildRequest?.requestedFromView
      );

  const { setShouldPoll } = usePollBuildStatus();

  const { cancelableFetch } = useCancelableFetch();
  const triggerBuild = React.useCallback(async () => {
    const buildRequests = environmentsToBeBuilt.map((environmentUuid) => ({
      environment_uuid: environmentUuid,
      project_uuid: buildRequest?.projectUuid,
    }));

    try {
      await cancelableFetch("/catch/api-proxy/api/environment-builds", {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({
          environment_image_build_requests: buildRequests,
        }),
      });
      setShouldPoll(true);
      await validate();
    } catch (error) {
      console.error("Failed to start environment builds:", error);
    }
  }, [
    buildRequest?.projectUuid,
    cancelableFetch,
    environmentsToBeBuilt,
    validate,
    setShouldPoll,
  ]);

  const viewBuildStatus = React.useCallback(
    (e: React.MouseEvent) => {
      if (projectUuid) {
        navigateTo(siteMap.environments.path, { query: { projectUuid } }, e);
        cancel();
      }
    },
    [projectUuid, cancel, navigateTo]
  );

  return {
    message,
    isBuilding,
    triggerBuild,
    viewBuildStatus,
    cancel,
    allowBuild,
  };
};
