import { FilePicker } from "@/components/FilePicker";
import { hasExtension, trimLeadingSlash } from "@/utils/path";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import React from "react";

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
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(selectedPath);
        }}
      >
        <DialogTitle>Load job parameters file</DialogTitle>
        <DialogContent sx={{ overflowY: "visible" }}>
          <Stack direction="column" spacing={2}>
            <FilePicker
              hideCreateFile
              hideRoots
              scope={{ pipelineUuid }}
              root="/project-dir"
              fileFilter={(path) => hasExtension(path, ".json")}
              onChange={(_root, path) =>
                setSelectedPath(trimLeadingSlash(path))
              }
            />
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
