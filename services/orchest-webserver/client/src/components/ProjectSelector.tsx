// @ts-check
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { siteMap, withinProjectPaths } from "@/routingConfig";
import type { Project } from "@/types";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputBase from "@mui/material/InputBase";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { Code } from "./common/Code";

const CustomInput = styled(InputBase)(({ theme }) => ({
  "&.Mui-focused .MuiInputBase-input": {
    borderColor: theme.palette.grey[500],
  },
  "& .MuiInputBase-input": {
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.background.paper}`,
    fontSize: 16,
    padding: theme.spacing(1, 2, 1, 1),
    transition: theme.transitions.create(["border-color", "box-shadow"]),
    borderColor: theme.palette.grey[500],
  },
}));

export const ProjectSelector = () => {
  const { setAlert } = useAppContext();
  const { state, dispatch } = useProjectsContext();
  const {
    navigateTo,
    projectUuid: projectUuidFromRoute,
    pipelineUuid,
    jobUuid,
    runUuid,
  } = useCustomRoute();
  // if current view only involves ONE project, ProjectSelector would appear
  const matchWithinProjectPaths = useMatchRoutePaths(withinProjectPaths);

  const { cancelableFetch } = useCancelableFetch();

  const onChangeProject = (uuid: string) => {
    if (uuid) {
      const path = matchWithinProjectPaths
        ? matchWithinProjectPaths.root || matchWithinProjectPaths.path
        : siteMap.pipeline.path;

      navigateTo(path, {
        query: { projectUuid: uuid, pipelineUuid, jobUuid, runUuid },
      });
    }
  };

  // check whether given project is part of projects
  const validateProjectUuid = (
    uuidToValidate: string | undefined | null,
    projects: Project[]
  ): uuidToValidate is string => {
    if (!hasValue(uuidToValidate)) return false;

    return uuidToValidate
      ? projects.some((project) => project.uuid == uuidToValidate)
      : false;
  };

  // sync state.projectUuid and the route param projectUuid
  React.useEffect(() => {
    if (projectUuidFromRoute) {
      dispatch({ type: "SET_PROJECT", payload: projectUuidFromRoute });
    }
  }, [projectUuidFromRoute, dispatch]);

  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    // in case that project is deleted
    if (matchWithinProjectPaths) {
      cancelableFetch<Project[]>("/async/projects?skip_discovery=true")
        .then((fetchedProjects) => {
          dispatch({ type: "SET_PROJECTS", payload: fetchedProjects });
        })
        .catch((error) => console.log(error));
    }
  }, [matchWithinProjectPaths, cancelableFetch, dispatch]);

  React.useEffect(() => {
    if (state.hasLoadedProjects && matchWithinProjectPaths) {
      const validProjectUuid =
        state.projects.length > 0 &&
        projectUuidFromRoute &&
        validateProjectUuid(projectUuidFromRoute, state.projects);

      if (projectUuidFromRoute && !validProjectUuid) {
        setAlert(
          "Project not found",
          <Stack direction="column" spacing={2}>
            <Box>
              {`Couldn't find project `}
              <Code>{projectUuidFromRoute}</Code>
              {` . The project might have been deleted, or you might have had a wrong URL.`}
            </Box>
            <Box>Will try to load another existing project.</Box>
          </Stack>
        );
      }

      const newProjectUuid = validProjectUuid
        ? projectUuidFromRoute
        : state.projects[0]?.uuid;

      // Always update state.projectuuid.
      // This is the only place that set a valid projectUuid
      if (newProjectUuid) {
        dispatch({ type: "SET_PROJECT", payload: newProjectUuid });
      }

      // Only change project if newProjectUuid is different from projectUuidFromRoute
      // if newProjectUuid is undefined, it means that the page is being loaded for the first time,
      // no need to change project.
      if (newProjectUuid && newProjectUuid !== projectUuidFromRoute) {
        onChangeProject(newProjectUuid);
      }
    }
  }, [matchWithinProjectPaths, dispatch, state.hasLoadedProjects, setAlert]);

  if (
    !matchWithinProjectPaths ||
    !state.projects ||
    state.projects.length === 0
  )
    return null;

  return (
    <FormControl
      fullWidth
      sx={{
        width: "250px",
        label: {
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
