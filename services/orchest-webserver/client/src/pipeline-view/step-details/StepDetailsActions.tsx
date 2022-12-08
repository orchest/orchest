import { stepPathToProjectPath } from "@/utils/pipeline";
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
  const { pipelineCwd } = usePipelineDataContext();
  const { isReadOnly } = usePipelineDataContext();
  const { previewFile, openNotebook } = useOpenFile();

  const { deleteSteps } = useDeleteSteps();
  const onDelete = () => deleteSteps([step.uuid]);

  if (!pipelineCwd) return null;

  return (
    <Box
      sx={{
        padding: (theme) => theme.spacing(1, 2),
        borderTop: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      <Stack direction="row" justifyContent="space-between">
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={(event) => openNotebook(step.uuid, event)}
            onAuxClick={(event) => openNotebook(step.uuid, event)}
            data-test-id="step-view-in-jupyterlab"
            disabled={!doesStepFileExist || isReadOnly}
            sx={{ ...ellipsis(), flex: "1 1 auto", display: "flex" }}
          >
            Edit in JupyterLab
          </Button>
          <Button
            variant="text"
            onClick={(event) =>
              previewFile(
                stepPathToProjectPath(step.file_path, pipelineCwd),
                event
              )
            }
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
