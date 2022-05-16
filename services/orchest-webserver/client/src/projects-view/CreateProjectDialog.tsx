import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useProjectName } from "./hooks/useProjectName";

export const CreateProjectDialog = ({
  isOpen,
  onClose,
  projects,
}: {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
}) => {
  const { setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();
  const { dispatch } = useProjectsContext();

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
      const { project_uuid } = await fetcher<{ project_uuid: string }>(
        "/async/projects",
        {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({ name: projectName }),
        }
      );

      dispatch((state) => ({
        type: "SET_PROJECTS",
        payload: [
          ...state.projects,
          {
            path: projectName,
            uuid: project_uuid,
            pipeline_count: 0,
            job_count: 0,
            environment_count: 1, // by default, a project gets an environment Python 3
            project_snapshot_size: 0,
            env_variables: {},
            status: "READY",
          },
        ],
      }));

      dispatch({ type: "SET_PROJECT", payload: project_uuid });

      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid: project_uuid },
      });
    } catch (error) {
      setAlert(
        "Error",
        `Could not create project. ${error.message || "Reason unknown."}`
      );
    }
  };

  return (
    <Dialog open={isOpen} onClose={closeDialog} fullWidth maxWidth="xs">
      <form
        id="create-project"
        onSubmit={(e) => {
          e.preventDefault();
          onClickCreateProject();
        }}
      >
        <DialogTitle>Create a new project</DialogTitle>
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
          <Button color="secondary" tabIndex={-1} onClick={closeDialog}>
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
  );
};
