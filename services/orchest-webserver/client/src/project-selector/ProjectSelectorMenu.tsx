import { useProjectsContext } from "@/contexts/ProjectsContext";
import { ImportProjectButton } from "@/home-view/components/ImportProjectButton";
import { NewProjectButton } from "@/home-view/components/NewProjectButton";
import { HomeTabs as HomeTab } from "@/home-view/HomeView";
import { useCurrentQuery, useNavigate } from "@/hooks/useCustomRoute";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { isProjectPage, siteMap } from "@/routingConfig";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
import { GoToExamplesButton } from "./GoToExamplesButton";
import { ProjectSelectorMenuList } from "./ProjectSelectorMenuList";
import { ProjectSelectorPopover } from "./ProjectSelectorPopover";

type ProjectSelectorMenuProps = {
  open: boolean;
  onClose: () => void;
};

export const ProjectSelectorMenu = ({
  open,
  onClose,
}: ProjectSelectorMenuProps) => {
  const { dispatch } = useProjectsContext();
  const navigate = useNavigate();
  const { tab } = useCurrentQuery();

  const customNavigation = React.useCallback(
    (homeTab: HomeTab) => {
      onClose();
      const didPathChange =
        window.location.pathname !== siteMap.home.path ||
        (window.location.pathname === siteMap.home.path && tab !== homeTab);

      if (didPathChange) navigate({ route: "home", query: { tab: homeTab } });
    },
    [navigate, onClose, tab]
  );

  const goToProjects = () => {
    customNavigation("projects");
  };
  const goToExamples = () => {
    customNavigation("examples");
  };

  const selectProject = (projectUuid: string) => {
    dispatch({ type: "SET_PROJECT", payload: projectUuid });

    if (isProjectPage(window.location.pathname)) {
      navigate({ query: { projectUuid } });
    } else {
      navigate({ route: "pipeline", query: { projectUuid }, sticky: false });
    }

    onClose();
  };

  const createButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [importUrl] = useImportUrlFromQueryString(undefined);

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
        <NewProjectButton
          sx={{ flex: 1 }}
          variant="text"
          ref={createButtonRef}
          tabIndex={0}
        >
          New
        </NewProjectButton>
        <Divider
          orientation="vertical"
          flexItem
          sx={{ height: (theme) => theme.spacing(4.5) }}
        />
        <ImportProjectButton importUrl={importUrl} />
      </Stack>
      <ProjectSelectorMenuList
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
          data-test-id="project-drawer/projects"
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
