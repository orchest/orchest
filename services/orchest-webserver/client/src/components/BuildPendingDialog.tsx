import { useAppContext } from "@/contexts/AppContext";
import { useInterval } from "@/hooks/use-interval";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { EnvironmentValidationData } from "@/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { checkGate } from "../utils/webserver-utils";

const buildFailMessage = `Some environment builds of this project have failed. 
  You can try building them again, 
  but you might need to change the environment setup script in 
  order for the build to succeed.`;

export enum BUILD_IMAGE_SOLUTION_VIEW {
  PIPELINE = "Pipeline",
  JUPYTER_LAB = "JupyterLab",
}

const solutionMessages = {
  [BUILD_IMAGE_SOLUTION_VIEW.PIPELINE]:
    " You can cancel to open the project in read-only mode.",
  [BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB]:
    " To start JupyterLab all environments in the project need to be built.",
};

const getInactiveEnvironmentsMessage = (
  inactiveEnvironments: string[],
  requestedFromView: string | undefined
) => {
  const inactiveEnvironmentsMessage =
    inactiveEnvironments.length > 0
      ? `Not all environments of this project have been built. Would you like to build them?`
      : `Some environments of this project are still building. Please wait until the build is complete.`;
  const solutionMessage = solutionMessages[requestedFromView || ""] || "";

  return `${inactiveEnvironmentsMessage}${solutionMessage}`;
};

const BuildPendingDialog: React.FC = () => {
  const { navigateTo } = useCustomRoute();
  const {
    state: { buildRequest },
    dispatch,
  } = useAppContext();

  const [gateInterval, setGateInterval] = React.useState<number | null>(null);

  const [building, setBuilding] = React.useState(false);
  const [showBuildStatus, setShowBuildStatus] = React.useState(false);
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
    if (!buildRequest) return;
    checkGate(buildRequest.projectUuid)
      .then(() => {
        setBuilding(false);

        if (buildRequest?.onBuildComplete) buildRequest.onBuildComplete();

        onClose();
      })
      .catch((error) => {
        // Gate check failed, check why it failed and act
        // accordingly
        processValidationData(error.data);
      });
  }, gateInterval);

  const processValidationData = React.useCallback(
    (data: EnvironmentValidationData) => {
      let inactiveEnvironments: string[] = [];
      let buildHasFailed = false;
      let environmentsBuilding = 0;
      let buildingValue = false;

      for (let x = 0; x < data.actions.length; x++) {
        const action = data.actions[x];

        if (["BUILD", "RETRY"].includes(action))
          inactiveEnvironments.push(data.fail[x]);

        if (action === "RETRY") buildHasFailed = true;
        if (action === "WAIT") {
          buildingValue = true;
          environmentsBuilding++;
        }
      }

      let message = buildHasFailed
        ? buildFailMessage
        : getInactiveEnvironmentsMessage(
            inactiveEnvironments,
            buildRequest?.requestedFromView
          );

      setEnvironmentsToBeBuilt(inactiveEnvironments);
      setBuilding(buildingValue);
      setShowBuildStatus(inactiveEnvironments.length === 0);
      setAllowBuild(inactiveEnvironments.length > 0);
      setState((prevState) => ({
        ...prevState,
        buildHasFailed,
        message,
        environmentsBuilding,
      }));

      if (environmentsBuilding > 0) {
        startPollingGate();
      } else {
        setGateInterval(null);
      }
    },
    [buildRequest?.requestedFromView]
  );

  React.useEffect(() => {
    if (buildRequest?.environmentValidationData)
      processValidationData(buildRequest.environmentValidationData);

    return () => setGateInterval(null);
  }, [buildRequest, processValidationData]);

  if (!buildRequest) return null;

  const onClose = () => {
    dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
  };

  const startPollingGate = () => {
    setGateInterval(1000);
  };

  const onBuild = () => {
    if (!buildRequest) return;

    setBuilding(true);
    setShowBuildStatus(true);
    setAllowBuild(false);

    let environment_image_build_requests = environmentsToBeBuilt.map(
      (environmentUuid) => ({
        environment_uuid: environmentUuid,
        project_uuid: buildRequest.projectUuid,
      })
    );

    fetcher("/catch/api-proxy/api/environment-builds", {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({ environment_image_build_requests }),
    })
      .then(() => startPollingGate())
      .catch((error) => {
        console.error("Failed to start environment builds:", error);
      });
  };

  const onViewBuildStatus = (e: React.MouseEvent) => {
    if (!buildRequest) return;

    navigateTo(
      siteMap.environments.path,
      { query: { projectUuid: buildRequest.projectUuid } },
      e
    );

    onClose();
  };

  const cancel = () => {
    if (buildRequest?.onCancel) buildRequest.onCancel();

    onClose();
  };

  return (
    <Dialog open={hasValue(buildRequest)}>
      <DialogTitle>Build</DialogTitle>
      <DialogContent>
        <div>
          <p>{state?.message}</p>
          {building && (
            <Box sx={{ marginTop: 4 }}>
              <LinearProgress />
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel}>Cancel</Button>
        {showBuildStatus && (
          <Button
            variant={!allowBuild ? "contained" : undefined}
            color={!allowBuild ? "primary" : undefined}
            onClick={onViewBuildStatus}
            onAuxClick={onViewBuildStatus}
          >
            View build status
          </Button>
        )}
        {allowBuild && (
          <Button
            autoFocus
            variant="contained"
            color="primary"
            onClick={onBuild}
          >
            Build
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BuildPendingDialog;
