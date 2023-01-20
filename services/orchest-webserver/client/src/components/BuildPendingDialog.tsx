import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useBuildEnvironmentImages } from "@/hooks/useBuildEnvironmentImages";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import React from "react";

type BuildPendingDialogProps = { onCancel?: (isBuilding: boolean) => void };

const BuildPendingDialog = ({ onCancel }: BuildPendingDialogProps) => {
  const {
    dispatch,
    state: { buildRequest },
  } = useProjectsContext();
  const activeProject = useActiveProject();
  const {
    isBuilding,
    triggerBuilds,
    viewBuildStatus,
    message = "",
    cancel,
    allowBuild,
  } = useBuildEnvironmentImages();

  if (!buildRequest) return null;

  const build = () => {
    dispatch({
      type: "SET_PIPELINE_READONLY_REASON",
      payload: "environmentsBuildInProgress",
    });
    triggerBuilds();
  };

  const isOpen = buildRequest.projectUuid === activeProject?.uuid;
  const shouldHideCancel =
    buildRequest.requestedFromView === BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB &&
    isBuilding;

  return (
    <Dialog open={isOpen}>
      <DialogTitle>Build</DialogTitle>
      <DialogContent>
        <div>
          <p>{message}</p>
          {isBuilding && (
            <Box sx={{ marginTop: 4 }}>
              <LinearProgress />
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        {!shouldHideCancel && (
          <Button
            onClick={() => {
              cancel();
              onCancel?.(isBuilding);
            }}
          >
            Cancel
          </Button>
        )}
        {isBuilding && (
          <Button
            variant={!allowBuild ? "contained" : undefined}
            color={!allowBuild ? "primary" : undefined}
            onClick={viewBuildStatus}
            onAuxClick={viewBuildStatus}
          >
            View build status
          </Button>
        )}
        {allowBuild && (
          <Button autoFocus variant="contained" color="primary" onClick={build}>
            Build
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BuildPendingDialog;
