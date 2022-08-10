import { useAppContext } from "@/contexts/AppContext";
import { Project } from "@/types";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useProjectName } from "./hooks/useProjectName";

// TODO: move to project settings

type RenameProjectDialogProps = {
  projectUuid: string | undefined;
  onClose: () => void;
  onSaved: (newPath: string) => void;
  projects: Project[];
};

export const RenameProjectDialog = ({
  projectUuid,
  projects,
  onClose,
  onSaved,
}: RenameProjectDialogProps) => {
  const { setAlert } = useAppContext();

  const [projectName, setProjectName, validation] = useProjectName(
    projects.filter(({ uuid }) => uuid !== projectUuid)
  );
  const [isUpdatingProjectPath, setIsUpdatingProjectPath] = React.useState(
    false
  );

  React.useEffect(() => {
    const found =
      hasValue(projectUuid) &&
      projects.find((project) => project.uuid === projectUuid);

    if (found) setProjectName(found.path);
  }, [projectUuid, projects, setProjectName]);

  const isFormValid =
    (projectName.length > 0 && validation.length === 0) ||
    isUpdatingProjectPath;

  const closeDialog = () => {
    onClose();
    setProjectName("");
    setIsUpdatingProjectPath(false);
  };

  const onSubmitEditProjectPathModal = async () => {
    if (!isFormValid) return;

    setIsUpdatingProjectPath(true);

    try {
      await fetcher(`/async/projects/${projectUuid}`, {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify({ name: projectName }),
      });

      onSaved(projectName);
      closeDialog();
    } catch (error) {
      setAlert("Error", String(error));
    }

    setIsUpdatingProjectPath(false);
  };

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={hasValue(projectUuid)}
      onClose={onClose}
    >
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
            value={projectName}
            label="Project name"
            helperText={validation || " "}
            error={validation.length > 0}
            disabled={isUpdatingProjectPath}
            onChange={({ target }) => {
              setProjectName(target.value.replace(/[^\w\.]/g, "-"));
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!isFormValid}
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
