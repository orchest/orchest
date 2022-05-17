import { useAppContext } from "@/contexts/AppContext";
import { Project } from "@/types";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { MutatorCallback } from "swr";
import { useProjectName } from "./hooks/useProjectName";

export const EditProjectPathDialog = ({
  projectUuid,
  onClose,
  setProjects,
  projects,
}: {
  projectUuid: string | undefined;
  onClose: () => void;
  setProjects: (
    data?:
      | Project[]
      | Promise<Project[]>
      | MutatorCallback<Project[]>
      | undefined
  ) => Promise<Project[] | undefined>;
  projects: Project[];
}) => {
  const { setAlert } = useAppContext();

  const [projectName, setProjectName, validation] = useProjectName(
    projects.filter((p) => p.uuid !== projectUuid)
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
      setProjects((projects) => {
        if (!projects) return projects;
        const copy = [...projects];
        const found = copy.find((p) => p.uuid === projectUuid);
        if (found) found.path = projectName;
        return copy;
      });
    } catch (error) {
      if (error.code == 0) {
        setAlert(
          "Error",
          "Cannot rename project when an interactive session is running."
        );
      }
      if (error.code == 1) {
        // Deprecated: form validation should have taken care of it
        setAlert(
          "Error",
          `Cannot rename project, a project with the name "${projectName}" already exists.`
        );
      }
    }
    closeDialog();
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
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitEditProjectPathModal();
        }}
      >
        <DialogTitle>Edit project name</DialogTitle>
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
            onChange={(e) => {
              setProjectName(e.target.value.replace(/[^\w\.]/g, "-"));
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="secondary" startIcon={<CloseIcon />} onClick={onClose}>
            Cancel
          </Button>
          <Button
            startIcon={<SaveIcon />}
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
