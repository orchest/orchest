import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useControlledIsOpen } from "@/hooks/useControlledIsOpen";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { siteMap } from "@/routingConfig";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useProjectName } from "./hooks/useProjectName";

type CreateProjectDialogProps = {
  open?: boolean;
  onClose?: () => void;
  children?: (onOpen: () => void) => React.ReactNode;
  postCreateCallback?: () => void;
};

export const CreateProjectDialog = ({
  open: isOpenByParent,
  onClose: onCloseByParent,
  postCreateCallback,
  children,
}: CreateProjectDialogProps) => {
  const { setAlert } = useGlobalContext();
  const { navigateTo } = useCustomRoute();
  const { dispatch } = useProjectsContext();
  const { projects } = useFetchProjects();
  const createProject = useProjectsApi((api) => api.create);

  const { isOpen, onClose, onOpen } = useControlledIsOpen(
    isOpenByParent,
    onCloseByParent
  );

  const [projectName, setProjectName, validation] = useProjectName(projects);

  const closeDialog = () => {
    onClose();
    setProjectName("");
  };

  const isFormValid = projectName.length > 0 && validation.length === 0;

  const onClickCreateProject = async () => {
    if (!isFormValid) return;

    onClose();
    try {
      const newProject = await createProject(projectName);

      dispatch({ type: "SET_PROJECT", payload: newProject.uuid });
      postCreateCallback?.();

      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid: newProject.uuid },
      });
    } catch (error) {
      postCreateCallback?.();

      setAlert("Failed to create project", <ErrorSummary error={error} />);
    }
  };

  return (
    <>
      {hasValue(children) && children(onOpen)}
      <Dialog
        open={isOpen}
        onClose={closeDialog}
        data-test-id="create-project-dialog"
        fullWidth
        maxWidth="xs"
      >
        <form
          id="create-project"
          onSubmit={(e) => {
            e.preventDefault();
            onClickCreateProject();
          }}
        >
          <DialogTitle>New project</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              autoFocus
              required
              sx={{ marginTop: (theme) => theme.spacing(2) }}
              label="Project name"
              error={validation.length > 0}
              helperText={validation || " "}
              value={projectName}
              onChange={(e) =>
                setProjectName(e.target.value.replace(/[^\w\.]/g, "-"))
              }
              data-test-id="create-project-dialog-name-input"
            />
          </DialogContent>
          <DialogActions>
            <Button tabIndex={-1} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              form="create-project"
              disabled={!isFormValid}
              data-test-id="create-project-dialog-submit-button"
            >
              Create project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};
