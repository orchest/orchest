import { useAppContext } from "@/contexts/AppContext";
import { useInterval } from "@/hooks/use-interval";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { EnvironmentValidationData } from "@/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import { hasValue, makeRequest } from "@orchest/lib-utils";
import React from "react";
import { checkGate } from "../utils/webserver-utils";

const buildFailMessage = `Some environment builds of this project have failed. 
  You can try building them again, 
  but you might need to change the environment setup script in 
  order for the build to succeed.`;

const solutionMessages = {
  Pipeline: " You can cancel to open the project in read-only mode.",
  JupyterLab:
    " To start JupyterLab all environments in the project need to be built.",
};

const getInactiveEnvironmentsMessage = (
  inactiveEnvironments: string[],
  requestedFromView: string
) => {
  const inactiveEnvironmentsMessage =
    inactiveEnvironments.length > 0
      ? `Not all environments of this project have been built. Would you like to build them?`
      : `Some environments of this project are still building. Please wait until the build is complete.`;
  const solutionMessage = solutionMessages[requestedFromView] || "";

  return `${inactiveEnvironmentsMessage}${solutionMessage}`;
};

const BuildPendingDialog: React.FC = () => {
  const { navigateTo } = useCustomRoute();
  const {
    state: { buildRequest },
    dispatch,
  } = useAppContext();

  const [gateInterval, setGateInterval] = React.useState(null);
  const [state, setState] = React.useState<{
    buildHasFailed: boolean;
    message: string;
    environmentsBuilding: number;
    allowBuild: boolean;
    showBuildStatus: boolean;
    building: boolean;
  }>(null);
  const [environmentsToBeBuilt, setEnvironmentsToBeBuilt] = React.useState<
    string[]
  >([]);

  useInterval(() => {
    if (!buildRequest) return;
    checkGate(buildRequest.projectUuid)
      .then(() => {
        setState((prevState) => ({
          ...prevState,
          building: false,
        }));

        if (onBuildComplete) onBuildComplete();

        onClose();
      })
      .catch((error) => {
        // Gate check failed, check why it failed and act
        // accordingly
        processValidationData(error.data);
      });
  }, gateInterval);

  React.useEffect(() => {
    if (buildRequest?.environmentValidationData)
      processValidationData(buildRequest.environmentValidationData);

    return () => setGateInterval(null);
  }, [buildRequest]);

  if (!buildRequest) return null;

  const {
    onCancel,
    onBuildComplete,
    projectUuid,
    requestedFromView,
  } = buildRequest;

  const onClose = () => {
    dispatch({ type: "SET_BUILD_REQUEST", payload: undefined });
  };

  const processValidationData = (data: EnvironmentValidationData) => {
    let inactiveEnvironments: string[] = [];
    let buildHasFailed = false;
    let environmentsBuilding = 0;
    let building = false;

    for (let x = 0; x < data.actions.length; x++) {
      const action = data.actions[x];

      if (["BUILD", "RETRY"].includes(action))
        inactiveEnvironments.push(data.fail[x]);

      if (action === "RETRY") buildHasFailed = true;
      if (action === "WAIT") {
        building = true;
        environmentsBuilding++;
      }
    }

    let message = buildHasFailed
      ? buildFailMessage
      : getInactiveEnvironmentsMessage(inactiveEnvironments, requestedFromView);

    setEnvironmentsToBeBuilt(inactiveEnvironments);
    setState((prevState) => ({
      ...prevState,
      building,
      buildHasFailed,
      message,
      environmentsBuilding,
      showBuildStatus: inactiveEnvironments.length == 0,
      allowBuild: inactiveEnvironments.length > 0,
    }));

    if (environmentsBuilding > 0) {
      startPollingGate();
    } else {
      setGateInterval(null);
    }
  };

  const startPollingGate = () => {
    setGateInterval(1000);
  };

  const onBuild = () => {
    setState((prevState) => ({
      ...prevState,
      allowBuild: false,
      showBuildStatus: true,
      building: true,
    }));

    let environment_image_build_requests = environmentsToBeBuilt.map(
      (environmentUuid) => ({
        environment_uuid: environmentUuid,
        project_uuid: projectUuid,
      })
    );

    makeRequest("POST", "/catch/api-proxy/api/environment-builds", {
      type: "json",
      content: { environment_image_build_requests },
    })
      .then(() => startPollingGate())
      .catch((error) => {
        console.error("Failed to start environment builds:", error);
      });
  };

  const onViewBuildStatus = (e: React.MouseEvent) => {
    navigateTo(siteMap.environments.path, { query: { projectUuid } }, e);

    onClose();
  };

  const cancel = () => {
    if (onCancel) onCancel();

    onClose();
  };

  return (
    <Dialog open={hasValue(buildRequest)}>
      <DialogTitle>Build</DialogTitle>
      <DialogContent>
        <div>
          <p>{state?.message}</p>
          {state?.building && (
            <Box sx={{ marginTop: 4 }}>
              <LinearProgress />
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel}>Cancel</Button>
        {state?.showBuildStatus && (
          <Button
            variant={!state?.allowBuild ? "contained" : undefined}
            color={!state?.allowBuild ? "primary" : undefined}
            onClick={onViewBuildStatus}
            onAuxClick={onViewBuildStatus}
          >
            View build status
          </Button>
        )}
        {state?.allowBuild && (
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
