import { ellipsis } from "@/utils/styles";
import { DeleteOutline } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useDeleteSteps } from "../hooks/useDeleteSteps";
import { useOpenFile } from "../hooks/useOpenFile";
import { useStepDetailsContext } from "./StepDetailsContext";

export const StepDetailsActions = () => {
  const { doesStepFileExist, step } = useStepDetailsContext();
  const { isReadOnly } = usePipelineDataContext();
  const { openFilePreviewView, openNotebook } = useOpenFile();

  const { deleteSteps } = useDeleteSteps();
  const onDelete = () => deleteSteps([step.uuid]);

  return (
    <Box
      sx={{
        padding: (theme) => theme.spacing(2, 3, 0),
        borderTop: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      <Stack
        spacing={2}
        direction="row"
        justifyContent="space-between"
        sx={{ marginBottom: (theme) => theme.spacing(3) }}
      >
        <Stack gap={2} direction="row">
          <Button
            variant="contained"
            onClick={(event) => openNotebook(event, step.uuid)}
            onAuxClick={(event) => openNotebook(event, step.uuid)}
            data-test-id="step-view-in-jupyterlab"
            disabled={!doesStepFileExist || isReadOnly}
            sx={{ ...ellipsis(), flex: "1 1 auto", display: "flex" }}
          >
            Edit in JupyterLab
          </Button>
          <Button
            variant="text"
            onClick={(event) => openFilePreviewView(event, step.uuid)}
            onAuxClick={(event) => openFilePreviewView(event, step.uuid)}
            data-test-id="step-view-file"
            disabled={!doesStepFileExist}
          >
            Preview
          </Button>
        </Stack>
        <IconButton
          disabled={isReadOnly}
          onClick={onDelete}
          data-test-id="step-delete"
        >
          <DeleteOutline />
        </IconButton>
      </Stack>
    </Box>
  );
};
