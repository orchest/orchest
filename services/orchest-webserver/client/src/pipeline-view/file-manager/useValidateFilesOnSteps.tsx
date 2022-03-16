import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { cleanFilePath, validateFiles } from "./common";
import { useFileManagerContext } from "./FileManagerContext";

export const useValidateFilesOnSteps = () => {
  const { setAlert } = useAppContext();
  const { pipelineJson } = usePipelineEditorContext();
  const { selectedFiles } = useFileManagerContext();

  const getApplicableStepFiles = React.useCallback(() => {
    const { forbidden, allowed } = validateFiles(
      pipelineJson?.steps,
      selectedFiles
    );
    if (forbidden.length > 0) {
      setAlert(
        "Warning",
        <Stack spacing={2} direction="column">
          <Box>
            Following Notebook files have already been used in the pipeline.
            Assigning the same Notebook file to multiple steps is not supported.
            Please convert to a script to re-use file across pipeline steps.
          </Box>
          <ul>
            {forbidden.map((file) => (
              <Box key={file}>
                <Code>{cleanFilePath(file)}</Code>
              </Box>
            ))}
          </ul>
        </Stack>
      );
    }
    return { forbidden, allowed };
  }, [pipelineJson?.steps, selectedFiles, setAlert]);

  return getApplicableStepFiles;
};
