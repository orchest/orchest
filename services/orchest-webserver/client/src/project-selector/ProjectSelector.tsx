import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { siteMap, withinProjectPaths } from "@/routingConfig";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputBase from "@mui/material/InputBase";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import React from "react";
import { Code } from "../components/common/Code";
import { useProjectSelector } from "./useProjectSelector";

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
  const { projectUuid: projectUuidFromRoute, navigateTo } = useCustomRoute();

  const customNavigateTo = React.useCallback(
    (projectUuid: string, path: string | undefined) => {
      navigateTo(path || siteMap.pipeline.path, { query: { projectUuid } });
    },
    [navigateTo]
  );

  const matchWithinProjectPaths = useMatchRoutePaths(withinProjectPaths);

  const {
    validProjectUuid,
    projects,
    onChangeProject,
    shouldShowInvalidProjectUuidAlert,
  } = useProjectSelector(
    projectUuidFromRoute,
    matchWithinProjectPaths?.root || matchWithinProjectPaths?.path,
    customNavigateTo
  );

  // If `project_uuid` query arg exists but not valid, user should be prompted with an alert.
  React.useEffect(() => {
    if (shouldShowInvalidProjectUuidAlert) {
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
    // This effect shouldn't be triggered if ONLY projectUuidFromRoute is changed.
  }, [setAlert, shouldShowInvalidProjectUuidAlert, projectUuidFromRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!validProjectUuid) return null;

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
        value={validProjectUuid}
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
        {(projects || []).map((project) => {
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
