import { projectsApi } from "@/api/projects/projectsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useControlledIsOpen } from "@/hooks/useControlledIsOpen";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import {
  INITIAL_PIPELINE_NAME,
  INITIAL_PIPELINE_PATH,
} from "@/pipeline-view/CreatePipelineDialog";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useProjectName } from "./hooks/useProjectName";

const defaultPipeline = {
  name: INITIAL_PIPELINE_NAME,
  pipeline_path: INITIAL_PIPELINE_PATH,
};

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
  const {
    state: { projects = [] },
    dispatch,
  } = useProjectsContext();

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
      const { project_uuid: projectUuid } = await projectsApi.post(projectName);

      dispatch((state) => {
        const currentProjects = state.projects || [];
        const newProject: Project = {
          path: projectName,
          uuid: projectUuid,
          pipeline_count: 0,
          active_job_count: 0,
          environment_count: 1, // by default, a project gets an environment Python 3
          project_snapshot_size: 0,
          env_variables: {},
          status: "READY",
        };
        return {
          type: "SET_PROJECTS",
          payload: [...currentProjects, newProject],
        };
      });

      dispatch({ type: "SET_PROJECT", payload: projectUuid });
      postCreateCallback?.();
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid: projectUuid },
      });
    } catch (error) {
      postCreateCallback?.();
      setAlert(
        "Error",
        `Could not create project. ${error.message || "Reason unknown."}`
      );
    }
  };

  return (
    <>
      {hasValue(children) && children(onOpen)}
      <Dialog open={isOpen} onClose={closeDialog} fullWidth maxWidth="xs">
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
              data-test-id="project-name-textfield"
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
              data-test-id="create-project"
            >
              Create project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};
