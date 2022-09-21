import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useBuildEnvironmentImage } from "@/environments-view/hooks/useBuildEnvironmentImage";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useInterval } from "@/hooks/useInterval";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
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
  const { runUuid, snapshotUuid } = useCustomRoute();
  const validate = useEnvironmentsApi((state) => state.validate);
  const status = useEnvironmentsApi((state) => state.status);

  const isRunningOnSnapshot = hasValue(runUuid) || hasValue(snapshotUuid);
  const {
    state: { buildRequest },
    dispatch,
  } = useProjectsContext();

  const isMounted = useMounted();
  const [shouldPoll, setShouldPoll] = React.useState(false);

  React.useEffect(() => {
    if (isMounted.current && !isRunningOnSnapshot) {
      setShouldPoll(status !== "allEnvironmentsBuilt");
    }
  }, [status, isMounted, isRunningOnSnapshot]);

  const checkAllEnvironmentsHaveBeenBuilt = React.useCallback(async () => {
    const result = await validate();
    if (!result) return;
    const [environmentValidationData, status] = result;
    setShouldPoll(status !== "allEnvironmentsBuilt");
    if (environmentValidationData?.validation === "pass") {
      buildRequest?.onComplete();
      dispatch({ type: "COMPLETE_BUILD_REQUEST" });
    }
  }, [validate, buildRequest, dispatch]);

  useInterval(
    checkAllEnvironmentsHaveBeenBuilt,
    isMounted.current && shouldPoll ? 1000 : null
  );

  React.useEffect(() => {
    if (!isRunningOnSnapshot) {
      checkAllEnvironmentsHaveBeenBuilt();
    }
  }, [isRunningOnSnapshot, checkAllEnvironmentsHaveBeenBuilt]);

  return { setShouldPoll };
};

export const useBuildEnvironmentImages = () => {
  const { navigateTo } = useCustomRoute();

  const {
    state: { projectUuid, buildRequest },
    dispatch,
  } = useProjectsContext();

  const validate = useEnvironmentsApi((state) => state.validate);
  const status = useEnvironmentsApi((state) => state.status);
  const environmentsToBeBuilt = useEnvironmentsApi(
    (state) => state.environmentsToBeBuilt
  );

  const cancel = React.useCallback(() => {
    buildRequest?.onCancel();
    dispatch({ type: "CANCEL_BUILD_REQUEST" });
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

  const [triggerBuildEnvironments] = useBuildEnvironmentImage();

  const triggerBuilds = React.useCallback(async () => {
    try {
      setShouldPoll(true);
      await triggerBuildEnvironments(environmentsToBeBuilt);

      setShouldPoll(true);
      await validate();
    } catch (error) {
      console.error("Failed to start environment builds:", error);
    }
  }, [
    environmentsToBeBuilt,
    triggerBuildEnvironments,
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
    triggerBuilds,
    viewBuildStatus,
    cancel,
    allowBuild,
  };
};
