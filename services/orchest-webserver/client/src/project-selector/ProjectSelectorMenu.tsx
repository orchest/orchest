import { useProjectsContext } from "@/contexts/ProjectsContext";
import { ImportProjectButton } from "@/home-view/components/ImportProjectButton";
import { NewProjectButton } from "@/home-view/components/NewProjectButton";
import { useNavigate } from "@/hooks/useCustomRoute";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { isProjectPage } from "@/routingConfig";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
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
      <Stack>
        <ProjectSelectorMenuList
          selectProject={selectProject}
          onSearchKeydown={(e) => {
            if (e.key === "ArrowUp") {
              createButtonRef.current?.focus();
            }
          }}
        />

        <Box
          component="img"
          src="/image/logo-wordmark.svg"
          margin="0 auto"
          width="112px"
          paddingY="40px"
        />
      </Stack>
    </ProjectSelectorPopover>
  );
};
