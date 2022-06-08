import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useStepDetailsContext } from "./StepDetailsContext";

export const StepDetailsControlPanel = ({
  onOpenNotebook,
  onOpenFilePreviewView,
  onDelete,
}: {
  onOpenNotebook: (e: React.MouseEvent) => void;
  onOpenFilePreviewView: (e: React.MouseEvent, uuid: string) => void;
  onDelete: () => void;
}) => {
  const { doesStepFileExist, step } = useStepDetailsContext();
  const { isReadOnly, dispatch } = usePipelineEditorContext();

  const onClose = () => {
    dispatch({ type: "SET_OPENED_STEP", payload: undefined });
  };

  return (
    <Box sx={{ padding: (theme) => theme.spacing(2, 3, 0) }}>
      <Stack
        spacing={2}
        alignItems="flex-start"
        sx={{ marginBottom: (theme) => theme.spacing(2) }}
      >
        {!isReadOnly && (
          <Button
            startIcon={<LaunchIcon />}
            variant="contained"
            onClick={onOpenNotebook}
            onAuxClick={onOpenNotebook}
            data-test-id="step-view-in-jupyterlab"
            disabled={!doesStepFileExist}
          >
            Edit in JupyterLab
          </Button>
        )}
        <Button
          startIcon={<VisibilityIcon />}
          variant="contained"
          color="secondary"
          onClick={(e) => onOpenFilePreviewView(e, step.uuid)}
          onAuxClick={(e) => onOpenFilePreviewView(e, step.uuid)}
          data-test-id="step-view-file"
          disabled={!isReadOnly && !doesStepFileExist} // file exists endpoint doesn't consider job runs
        >
          View file
        </Button>
      </Stack>
      <Stack
        spacing={2}
        direction="row"
        sx={{ marginBottom: (theme) => theme.spacing(3) }}
      >
        <Button
          startIcon={<CloseIcon />}
          color="secondary"
          onClick={onClose}
          data-test-id="step-close-details"
        >
          Close
        </Button>
        {!isReadOnly && (
          <Button
            startIcon={<DeleteIcon />}
            color="secondary"
            onClick={onDelete}
            data-test-id="step-delete"
          >
            Delete
          </Button>
        )}
      </Stack>
    </Box>
  );
};
