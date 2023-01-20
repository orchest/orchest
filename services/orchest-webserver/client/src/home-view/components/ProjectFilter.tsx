import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { Project } from "@/types";
import { basename } from "@/utils/path";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { MultiFilter } from "./MultiFilter";

export type ProjectFilterProps = {
  selected: Project[];
  onChange: (projects: Project[]) => void;
};

export const ProjectFilter = ({ selected, onChange }: ProjectFilterProps) => {
  const projects = useProjectsApi((api) => api.projects);
  const uuids = selected.map(({ uuid }) => uuid);
  const [search, setSearch] = React.useState("");
  const filteredProjects = React.useMemo(() => {
    const lowerSearch = search.toLowerCase();

    return Object.values(projects ?? {}).filter((project) =>
      basename(project.path).toLowerCase().includes(lowerSearch)
    );
  }, [search, projects]);

  if (!projects) return null;

  const handleChange = (uuids: string[]) =>
    onChange(uuids.map((uuid) => projects[uuid]).filter(hasValue));

  return (
    <MultiFilter
      label="Project"
      id="project"
      minWidth="93px"
      selected={selected.map(({ uuid }) => uuid)}
      onChange={handleChange}
      prettify={(uuid) => basename(projects[uuid].path)}
      MenuProps={{
        sx: { ".MuiMenu-paper": { maxWidth: "260px" } },
      }}
    >
      <Box paddingX={1}>
        <OutlinedInput
          fullWidth
          size="small"
          value={search}
          placeholder="Search"
          aria-label="Search projects"
          onChange={({ target }) => setSearch(target.value)}
          startAdornment={
            <SearchOutlined color="action" sx={{ marginRight: 1 }} />
          }
        />
      </Box>

      {filteredProjects.map((project) => (
        <MenuItem dense key={project.uuid} value={project.uuid}>
          <Checkbox checked={uuids.includes(project.uuid)} />
          {basename(project.path)}
        </MenuItem>
      ))}
    </MultiFilter>
  );
};
