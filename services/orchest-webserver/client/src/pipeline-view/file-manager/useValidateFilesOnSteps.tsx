import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useFileManagerState } from "../hooks/useFileManagerState";
import {
  allowedExtensionsMarkup,
  cleanFilePath,
  validateFiles,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";

export const useValidateFilesOnSteps = () => {
  const { setAlert } = useGlobalContext();
  const { pipelineJson } = usePipelineDataContext();
  const selectedFiles = useFileManagerState((state) => state.selected);
  const { dragFile } = useFileManagerContext();

  const filesToProcess = React.useMemo(() => {
    if (!dragFile?.path) return selectedFiles;
    return selectedFiles.includes(dragFile.path)
      ? selectedFiles
      : [dragFile.path];
  }, [selectedFiles, dragFile?.path]);

  const getApplicableStepFiles = React.useCallback(
    (stepUuid?: string) => {
      const { usedNotebookFiles, forbidden, allowed } = validateFiles(
        stepUuid,
        pipelineJson?.steps,
        filesToProcess
      );

      if (forbidden.length > 0) {
        setAlert(
          "Warning",
          <Stack spacing={2} direction="column">
            <Box>
              {`Supported file extensions are: `}
              {allowedExtensionsMarkup}
              {`. Unable to apply following files to a step:`}
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
      if (usedNotebookFiles.length > 0) {
        setAlert(
          "Warning",
          <Stack spacing={2} direction="column">
            <Box>
              {`The following Notebook files have already been used in the
              pipeline. Assigning the same Notebook file to multiple steps is
              not supported. Please convert them to scripts in order to reuse
              the code, e.g. `}
              <Code>.sh</Code>, <Code>.py</Code>,<Code>.R</Code>, or{" "}
              <Code>.jl</Code>.
            </Box>
            <ul>
              {usedNotebookFiles.map((file) => (
                <Box key={file}>
                  <Code>{cleanFilePath(file)}</Code>
                </Box>
              ))}
            </ul>
          </Stack>
        );
      }
      return { usedNotebookFiles, forbidden, allowed };
    },
    [pipelineJson?.steps, filesToProcess, setAlert]
  );

  return getApplicableStepFiles;
};
