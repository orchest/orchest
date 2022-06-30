import { SearchField } from "@/components/SearchField";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { CreateProjectDialog } from "@/projects-view/CreateProjectDialog";
import { ImportDialog } from "@/projects-view/ImportDialog";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import { ellipsis } from "@/utils/styles";
import AddIcon from "@mui/icons-material/Add";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { ProjectSelectorPopover } from "./ProjectSelectorPopover";

export const HEADER_BAR_HEIGHT = 56;

export const ProjectSelectorMenu = ({
  open,
  onClose,
  projects,
  validProjectUuid,
  selectProject,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  validProjectUuid: string | undefined;
  selectProject: (projectUuid: string) => void;
}) => {
  const { navigateTo } = useCustomRoute();

  const goToProjects = () => {
    onClose();
    navigateTo(siteMap.projects.path);
  };

  const menuFirstItemRef = React.useRef<HTMLLIElement | null>(null);
  const [importUrl, setImportUrl] = useImportUrlFromQueryString("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm.trim());

  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) =>
      project.path.includes(debouncedSearchTerm)
    );
  }, [debouncedSearchTerm, projects]);

  return (
    <ProjectSelectorPopover open={open} onClose={onClose}>
      <Box sx={{ width: (theme) => theme.spacing(40) }}>
        <Stack
          direction="row"
          justifyContent="space-around"
          sx={{
            width: "100%",
            padding: (theme) => theme.spacing(1, 2, 0),
          }}
        >
          <CreateProjectDialog projects={projects} postCreateCallback={onClose}>
            {(onOpen) => (
              <Button
                variant="text"
                autoFocus
                startIcon={<AddIcon />}
                onClick={onOpen}
                sx={{ flex: 1 }}
                data-test-id="add-project"
              >
                New
              </Button>
            )}
          </CreateProjectDialog>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ height: (theme) => theme.spacing(4.5) }}
          />
          <ImportDialog
            importUrl={importUrl}
            setImportUrl={setImportUrl}
            onImportComplete={(newProject) => {
              onClose();
              navigateTo(siteMap.pipeline.path, {
                query: { projectUuid: newProject.uuid },
              });
            }}
            confirmButtonLabel={`Save & view`}
          >
            {(onOpen) => (
              <Button
                variant="text"
                startIcon={<DownloadOutlinedIcon />}
                onClick={onOpen}
                sx={{ flex: 1 }}
                data-test-id="import-project"
              >
                Import
              </Button>
            )}
          </ImportDialog>
        </Stack>
        <Box
          sx={{
            padding: (theme) => theme.spacing(0, 2),
            marginBottom: (theme) => theme.spacing(1),
          }}
        >
          <SearchField
            autoFocus
            placeholder="Search Projects"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                menuFirstItemRef.current?.focus();
              }
            }}
          />
        </Box>
      </Box>
      <MenuList
        sx={{
          minHeight: (theme) => `calc(100vh - ${theme.spacing(29.5)})`,
          maxHeight: (theme) => `calc(100vh - ${theme.spacing(29.5)})`,
          overflowY: "auto",
        }}
      >
        {filteredProjects.length === 0 && debouncedSearchTerm.length > 0 && (
          <MenuItem disabled>
            <Typography variant="body2">No Projects found</Typography>
          </MenuItem>
        )}
        {filteredProjects.map((project, index) => {
          return (
            <MenuItem
              key={project.uuid}
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
      <Button
        disableRipple
        variant="text"
        sx={{
          width: "100%",
          borderTop: (theme) => `1px solid ${theme.borderColor}`,
          borderRadius: 0,
          height: (theme) => theme.spacing(8),
          verticalAlign: "middle",
        }}
        onClick={goToProjects}
      >
        View all projects
      </Button>
    </ProjectSelectorPopover>
  );
};
