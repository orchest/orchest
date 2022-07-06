import { SearchField } from "@/components/SearchField";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { ellipsis } from "@/utils/styles";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Typography from "@mui/material/Typography";
import React from "react";
import { useProjectList } from "./useProjectList";

export const ProjectSelectorMenuList = ({
  validProjectUuid,
  selectProject,
  onSearchKeydown,
}: {
  validProjectUuid: string | undefined;
  selectProject: (projectUuid: string) => void;
  onSearchKeydown: React.KeyboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  >;
}) => {
  const {
    state: { projects = [] },
  } = useProjectsContext();
  const menuFirstItemRef = React.useRef<HTMLLIElement | null>(null);
  const { searchTerm, setSearchTerm, filteredProjects } = useProjectList(
    projects
  );

  const noProjectsMessage =
    projects.length === 0
      ? "No projects yet"
      : filteredProjects.length === 0 && searchTerm.length > 0
      ? "No Projects found"
      : null;

  return (
    <>
      <Box
        sx={{
          padding: (theme) => theme.spacing(0, 2),
          marginBottom: (theme) => theme.spacing(1),
        }}
      >
        <SearchField
          autoFocus
          placeholder="Search Projects"
          tabIndex={0}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              menuFirstItemRef.current?.focus();
            }
            onSearchKeydown(e);
          }}
        />
      </Box>
      <MenuList
        sx={{
          minHeight: (theme) => `calc(100vh - ${theme.spacing(25.75)})`,
          maxHeight: (theme) => `calc(100vh - ${theme.spacing(25.75)})`,
          overflowY: "auto",
        }}
      >
        {noProjectsMessage && (
          <MenuItem disabled>
            <Typography variant="body2">{noProjectsMessage}</Typography>
          </MenuItem>
        )}
        {filteredProjects.map((project, index) => {
          return (
            <MenuItem
              key={project.uuid}
              tabIndex={0}
              ref={(ref) => {
                if (index === 0) menuFirstItemRef.current = ref;
              }}
              selected={validProjectUuid === project.uuid}
              onClick={() => selectProject(project.uuid)}
            >
              <Typography
                title={project.path}
                sx={ellipsis((theme) => theme.spacing(40))}
              >
                {project.path}
              </Typography>
            </MenuItem>
          );
        })}
      </MenuList>
    </>
  );
};
