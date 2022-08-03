import ProjectFilePicker from "@/components/ProjectFilePicker";
import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import {
  FileManagerContextProvider,
  useFileManagerContext,
} from "@/pipeline-view/file-manager/FileManagerContext";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import React from "react";

const ProjectFilePickerHolder = ({
  selectedPath,
  pipelineCwd,
  onChangeFilePath,
  pipelineUuid,
  jobUuid,
  runUuid,
}: {
  selectedPath: string;
  pipelineCwd: string;
  onChangeFilePath: React.Dispatch<React.SetStateAction<string>>;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
}) => {
  const { fetchFileTrees } = useFileManagerContext();

  React.useEffect(() => {
    fetchFileTrees(1);
  }, [fetchFileTrees]);

  const { projectUuid } = useCustomRoute();

  const [doesFileExist, isCheckingFileValidity] = useCheckFileValidity({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: selectedPath,
    allowedExtensions: ["json"],
    useProjectRoot: true,
  });

  return (
    <ProjectFilePicker
      value={selectedPath}
      allowedExtensions={["json"]}
      pipelineCwd={pipelineCwd}
      onChange={onChangeFilePath}
      doesFileExist={doesFileExist}
      isCheckingFileValidity={isCheckingFileValidity}
    />
  );
};

export const LoadParametersDialog = ({
  isOpen,
  onClose,
  onSubmit,
  pipelineUuid,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  pipelineUuid: string | undefined;
}) => {
  const [selectedPath, setSelectedPath] = React.useState("");
  const { projectUuid, jobUuid, runUuid } = useCustomRoute();

  // Always load parameters from project root
  const pipelineCwd = "/";

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { overflowY: "visible" } }}
    >
      <form
        id="load-parameters"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmit(selectedPath);
        }}
      >
        <DialogTitle>Load job parameters file</DialogTitle>
        <DialogContent sx={{ overflowY: "visible" }}>
          <Stack direction="column" spacing={2}>
            <FileManagerContextProvider
              projectUuid={projectUuid}
              pipelineUuid={pipelineUuid}
              jobUuid={jobUuid}
              runUuid={runUuid}
            >
              <ProjectFilePickerHolder
                selectedPath={selectedPath}
                pipelineCwd={pipelineCwd}
                onChangeFilePath={setSelectedPath}
                pipelineUuid={pipelineUuid}
                jobUuid={jobUuid}
                runUuid={runUuid}
              />
            </FileManagerContextProvider>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button tabIndex={-1} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" form="load-parameters">
            Load
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
