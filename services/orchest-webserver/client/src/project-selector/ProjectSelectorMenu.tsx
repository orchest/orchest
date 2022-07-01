import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { CreateProjectDialog } from "@/projects-view/CreateProjectDialog";
import { ImportDialog } from "@/projects-view/ImportDialog";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
import { GoToExamplesButton } from "./GoToExamplesButton";
import { ProjectSelectorMenuList } from "./ProjectSelectorMenuList";
import { ProjectSelectorPopover } from "./ProjectSelectorPopover";

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
  const { navigateTo, location } = useCustomRoute();

  const customNavigation = React.useCallback(
    (path: string) => {
      onClose();
      if (location.pathname !== path) navigateTo(path);
    },
    [location.pathname, navigateTo, onClose]
  );

  const goToProjects = () => {
    customNavigation(siteMap.projects.path);
  };
  const goToExamples = () => {
    customNavigation(siteMap.examples.path);
  };

  const createButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [importUrl, setImportUrl] = useImportUrlFromQueryString("");

  return (
    <ProjectSelectorPopover open={open} onClose={onClose}>
      <Stack
        direction="row"
        justifyContent="space-around"
        sx={{
          width: (theme) => theme.spacing(40),
          padding: (theme) => theme.spacing(1, 2, 0),
        }}
      >
        <CreateProjectDialog projects={projects} postCreateCallback={onClose}>
          {(onOpen) => (
            <Button
              variant="text"
              ref={createButtonRef}
              tabIndex={0}
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
              tabIndex={0}
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
      <ProjectSelectorMenuList
        projects={projects}
        validProjectUuid={validProjectUuid}
        selectProject={selectProject}
        onSearchKeydown={(e) => {
          if (e.key === "ArrowUp") {
            createButtonRef.current?.focus();
          }
        }}
      />
      <Stack direction="row" alignItems="center">
        <Button
          variant="text"
          tabIndex={0}
          sx={{
            flex: 1,
            borderRadius: 0,
            height: (theme) => theme.spacing(5),
            verticalAlign: "middle",
          }}
          onClick={goToProjects}
        >
          Projects page
        </Button>
        <Divider
          orientation="vertical"
          flexItem
          sx={{ height: (theme) => theme.spacing(4.5) }}
        />
        <GoToExamplesButton onClick={goToExamples} />
      </Stack>
    </ProjectSelectorPopover>
  );
};
