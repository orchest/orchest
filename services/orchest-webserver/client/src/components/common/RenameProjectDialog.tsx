import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { Project } from "@/types";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import React from "react";

type RenameProjectDialogProps = {
  open: boolean;
  project: Project;
  onClose: () => void;
};

export const RenameProjectDialog = ({
  open,
  project,
  onClose,
}: RenameProjectDialogProps) => {
  const { setAlert } = useGlobalContext();
  const projects = useProjectsApi((api) => api.projects);
  const renameProject = useProjectsApi((api) => api.rename);

  const [validationMessage, setValidationMessage] = React.useState<string>();
  const [newName, setNewName] = React.useState(project.path);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    if (project) setNewName(project.path);
  }, [project]);

  React.useEffect(() => {
    if (!projects) return;

    if (Object.values(projects).some((project) => project.path === newName)) {
      setValidationMessage("A project with the same name already exists.");
    } else {
      setValidationMessage(undefined);
    }
  }, [newName, projects]);

  const closeDialog = () => {
    onClose();
    setNewName("");
    setIsUpdating(false);
  };

  const onSubmitEditProjectPathModal = async () => {
    if (validationMessage) return;

    setIsUpdating(true);

    try {
      await renameProject(project.uuid, newName).then(closeDialog);
    } catch (error) {
      setAlert("Failed to rename project", <ErrorSummary error={error} />);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <form
        id="edit-name"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitEditProjectPathModal();
        }}
      >
        <DialogTitle>Rename project</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            required
            sx={{ marginTop: (theme) => theme.spacing(2) }}
            value={newName}
            label="Project name"
            helperText={validationMessage ?? " "}
            error={Boolean(validationMessage)}
            disabled={isUpdating}
            onChange={({ target }) => {
              setNewName(target.value.replace(/[^\w\.]/g, "-"));
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={Boolean(validationMessage)}
            type="submit"
            form="edit-name"
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
