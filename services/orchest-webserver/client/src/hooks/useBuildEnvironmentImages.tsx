import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useInterval } from "@/hooks/use-interval";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { EnvironmentValidationData } from "@/types";
import { HEADER } from "@orchest/lib-utils";
import React from "react";
import { checkGate } from "../utils/webserver-utils";

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
  inactiveEnvironments: string[],
  requestedFromView = ""
) => {
  const inactiveEnvironmentsMessage =
    inactiveEnvironments.length > 0
      ? `Not all environments of this project have been built. Would you like to build them?`
      : `Some environments of this project are still building. Please wait until the build is complete.`;
  const solutionMessage = solutionMessages[requestedFromView] || "";

  return `${inactiveEnvironmentsMessage}${solutionMessage}`;
};

export const useBuildEnvironmentImages = () => {
  const { navigateTo } = useCustomRoute();
  const {
    state: { projectUuid, buildRequest, pipelineReadOnlyReason },
    dispatch,
  } = useProjectsContext();

  const [gateInterval, setGateInterval] = React.useState<number | null>(null);

  const [isBuilding, setIsBuilding] = React.useState(
    pipelineReadOnlyReason === "environmentsBuildInProgress"
  );
  const [allowViewBuildStatus, setAllowViewBuildStatus] = React.useState(false);
  const [allowBuild, setAllowBuild] = React.useState(false);
  const [state, setState] = React.useState<{
    buildHasFailed: boolean;
    message: string;
    environmentsBuilding: number;
  } | null>(null);
  const [environmentsToBeBuilt, setEnvironmentsToBeBuilt] = React.useState<
    string[]
  >([]);

  useInterval(() => {
    if (!buildRequest || buildRequest.projectUuid !== projectUuid) return;
    checkGate(buildRequest.projectUuid)
      .then(() => {
        setIsBuilding(false);
        onComplete();
      })
      .catch((error) => {
        // Gate check failed, check why it failed and act
        // accordingly
        processValidationData(error.data);
      });
  }, gateInterval);

  const processValidationData = React.useCallback(
    (data: EnvironmentValidationData) => {
      const inactiveEnvironments: string[] = [];
      let buildHasFailed = false;
      let environmentsBuilding = 0;
      let buildingValue = false;

      data.actions.forEach((action, index) => {
        if (["BUILD", "RETRY"].includes(action))
          inactiveEnvironments.push(data.fail[index]);

        if (action === "RETRY") buildHasFailed = true;
        if (action === "WAIT") {
          buildingValue = true;
          environmentsBuilding++;
        }
      });

      const message = buildHasFailed
        ? buildFailMessage
        : getInactiveEnvironmentsMessage(
            inactiveEnvironments,
            buildRequest?.requestedFromView
          );

      setEnvironmentsToBeBuilt(inactiveEnvironments);
      setIsBuilding(buildingValue);
      setAllowViewBuildStatus(inactiveEnvironments.length === 0);
      setAllowBuild(inactiveEnvironments.length > 0);
      setState((prevState) => ({
        ...prevState,
        buildHasFailed,
        message,
        environmentsBuilding,
      }));
      dispatch({
        type: "SET_PIPELINE_READONLY_REASON",
        payload:
          inactiveEnvironments.length > 0
            ? "environmentsNotYetBuilt"
            : buildingValue
            ? "environmentsBuildInProgress"
            : undefined,
      });

      if (environmentsBuilding > 0) {
        startPollingGate();
      } else {
        setGateInterval(null);
      }
    },
    [buildRequest?.requestedFromView, dispatch]
  );

  React.useEffect(() => {
    if (buildRequest?.environmentValidationData)
      processValidationData(buildRequest.environmentValidationData);

    return () => setGateInterval(null);
  }, [buildRequest, processValidationData]);

  const onComplete = () => {
    buildRequest?.onComplete();
    dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
  };

  const cancel = React.useCallback(() => {
    buildRequest?.onCancel();
    dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
  }, [buildRequest, dispatch]);

  const startPollingGate = () => {
    setGateInterval(1000);
  };

  const { cancelableFetch } = useCancelableFetch();
  const triggerBuild = React.useCallback(async () => {
    if (!allowBuild) return;

    setIsBuilding(true);
    setAllowViewBuildStatus(true);
    setAllowBuild(false);
    dispatch({
      type: "SET_PIPELINE_READONLY_REASON",
      payload: "environmentsBuildInProgress",
    });

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
      startPollingGate();
    } catch (error) {
      console.error("Failed to start environment builds:", error);
    }
  }, [
    allowBuild,
    buildRequest?.projectUuid,
    cancelableFetch,
    dispatch,
    environmentsToBeBuilt,
  ]);

  const viewBuildStatus = React.useCallback(
    (e: React.MouseEvent) => {
      if (!buildRequest || !allowViewBuildStatus) return;

      navigateTo(
        siteMap.environments.path,
        { query: { projectUuid: buildRequest.projectUuid } },
        e
      );

      cancel();
    },
    [buildRequest, cancel, navigateTo, allowViewBuildStatus]
  );

  return {
    ...state,
    isBuilding,
    triggerBuild,
    viewBuildStatus,
    buildRequest,
    cancel,
    allowBuild,
    allowViewBuildStatus,
  };
};
