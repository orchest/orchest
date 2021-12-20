// @ts-check
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchProjectRoot } from "@/hooks/useMatchProjectRoot";
import { siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import FormControl from "@mui/material/FormControl";
import InputBase from "@mui/material/InputBase";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { styled } from "@mui/material/styles";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";

const CustomInput = styled(InputBase)(({ theme }) => ({
  "&.Mui-focused .MuiInputBase-input": {
    borderColor: theme.palette.grey[500],
  },
  "& .MuiInputBase-input": {
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.background.paper}`,
    fontSize: 20,
    padding: theme.spacing(1.5, 2, 1),
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    "&:hover": { borderColor: theme.palette.grey[500] },
    "&:focus": { borderColor: theme.palette.grey[500] },
  },
}));

const ProjectSelector = () => {
  const { state, dispatch } = useProjectsContext();
  const { navigateTo, projectUuid: projectUuidFromRoute } = useCustomRoute();
  const matchProjectRoot = useMatchProjectRoot();

  const [promiseManager] = React.useState(new PromiseManager());

  const onChangeProject = (uuid: string) => {
    if (uuid) {
      const path = matchProjectRoot
        ? matchProjectRoot.path
        : siteMap.pipelines.path;
      navigateTo(path, { query: { projectUuid: uuid } });
    }
  };

  // check whether given project is part of projects
  const validateProjectUuid = (
    uuidToValidate: string | undefined | null,
    projects: Project[]
  ): string | undefined => {
    let isValid = uuidToValidate
      ? projects.some((project) => project.uuid == uuidToValidate)
      : false;

    return isValid ? uuidToValidate : undefined;
  };

  const fetchProjects = () => {
    let fetchProjectsPromise = makeCancelable(
      makeRequest("GET", "/async/projects?skip_discovery=true"),
      promiseManager
    );

    fetchProjectsPromise.promise
      .then((response: string) => {
        let fetchedProjects: Project[] = JSON.parse(response);

        dispatch({
          type: "projectsSet",
          payload: fetchedProjects,
        });
      })
      .catch((error) => console.log(error));
  };

  // sync state.projectUuid and the route param projectUuid
  React.useEffect(() => {
    if (projectUuidFromRoute) {
      dispatch({ type: "projectSet", payload: projectUuidFromRoute });
    }
  }, [projectUuidFromRoute]);

  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    // in case that project is deleted
    if (matchProjectRoot) fetchProjects();

    return () => {
      promiseManager.cancelCancelablePromises();
    };
  }, [matchProjectRoot]);

  React.useEffect(() => {
    if (state.hasLoadedProjects && matchProjectRoot) {
      const invalidProjectUuid = !validateProjectUuid(
        projectUuidFromRoute,
        state.projects
      );

      if (invalidProjectUuid) {
        // Select the first one from the given projects
        let newProjectUuid =
          state.projects.length > 0 ? state.projects[0].uuid : undefined;

        // navigate ONLY if user is at the project root and
        // we're switching projects (because of detecting an
        // invalidProjectUuid)
        dispatch({ type: "projectSet", payload: newProjectUuid });
        onChangeProject(newProjectUuid);
      }
    }
  }, [matchProjectRoot, state.hasLoadedProjects]);

  if (!matchProjectRoot || !state.projects || state.projects.length === 0)
    return null;

  return (
    <FormControl
      fullWidth
      sx={{
        width: "250px",
        "&:hover label": {
          color: (theme) => theme.palette.grey[700],
        },
      }}
    >
      <InputLabel
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          padding: (theme) => theme.spacing(0, 1),
          color: (theme) => theme.palette.background.paper,
          "&.Mui-focused": {
            color: (theme) => theme.palette.grey[700],
          },
        }}
        id="select-project-label"
      >
        Project
      </InputLabel>
      <Select
        labelId="select-project-label"
        id="select-project"
        value={state.projectUuid || ""}
        label="Project"
        onChange={(e) => onChangeProject(e.target.value)}
        input={<CustomInput />}
        data-test-id="project-selector"
        sx={{
          "&.Mui-Focused .MuiSelect-select": {
            borderColor: (theme) => theme.palette.grey[500],
          },
        }}
      >
        {state.projects.map((project) => {
          return (
            <MenuItem key={project.uuid} value={project.uuid}>
              {project.path}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};

export default ProjectSelector;
