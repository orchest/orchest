import { useFileApi } from "@/api/files/useFileApi";
import { FilePicker } from "@/components/FilePicker";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileManagerContextProvider } from "@/pipeline-view/file-manager/FileManagerContext";
import { hasExtension } from "@/utils/path";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import React from "react";

type ProjectFilePickerHolderProps = {
  selectedPath: string;
  onChangeFilePath: (path: string) => void;
};

const ProjectFilePickerHolder = ({
  selectedPath,
  onChangeFilePath,
}: ProjectFilePickerHolderProps) => {
  const init = useFileApi((api) => api.init);
  const roots = useFileApi((api) => api.roots);

  React.useEffect(() => {
    if (Object.keys(roots).length !== 0) return;

    init(2, ["/project-dir", "/data"]);
  }, [init, roots]);

  return (
    <FilePicker
      selected={selectedPath}
      root="/project-dir"
      hideRoots={true}
      accepts={(path) => hasExtension(path, "json")}
      onChange={onChangeFilePath}
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
  onSubmit: (path: string) => void;
  pipelineUuid: string | undefined;
}) => {
  const [selectedPath, setSelectedPath] = React.useState("/");
  const { projectUuid, jobUuid, runUuid } = useCustomRoute();

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
                onChangeFilePath={setSelectedPath}
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
