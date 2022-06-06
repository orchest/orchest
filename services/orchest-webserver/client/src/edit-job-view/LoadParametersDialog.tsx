import ProjectFilePicker from "@/components/ProjectFilePicker";
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
}) => {
  const { fetchFileTrees } = useFileManagerContext();

  React.useEffect(() => {
    fetchFileTrees(1);
  }, []);

  return (
    <ProjectFilePicker
      value={selectedPath}
      allowedExtensions={["json"]}
      pipelineCwd={pipelineCwd}
      onChange={onChangeFilePath}
      menuMaxWidth={"100%"}
      pipelineUuid={pipelineUuid}
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
  const onChangeFilePath = (value) => {
    setSelectedPath(value);
  };

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
        <DialogTitle>Load parameter file</DialogTitle>
        <DialogContent sx={{ overflowY: "visible" }}>
          <Stack direction="column" spacing={2}>
            <FileManagerContextProvider>
              <ProjectFilePickerHolder
                selectedPath={selectedPath}
                pipelineCwd={pipelineCwd}
                onChangeFilePath={onChangeFilePath}
                pipelineUuid={pipelineUuid}
              />
            </FileManagerContextProvider>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" tabIndex={-1} onClick={onClose}>
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
