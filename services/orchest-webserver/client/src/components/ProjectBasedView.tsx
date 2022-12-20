import { useActiveProject } from "@/hooks/useActiveProject";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { siteMap } from "@/routingConfig";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { SxProps, Theme } from "@mui/material/styles";
import React from "react";

export interface IProjectBasedViewProps {
  sx?: SxProps<Theme>;
}

const message =
  "It looks like you don't have any projects yet! To get started using Orchest create your first project.";

const ProjectBasedView: React.FC<IProjectBasedViewProps> = ({
  children,
  sx,
}) => {
  const { navigateTo } = useCustomRoute();
  const { hasData: hasLoadedProjects } = useFetchProjects();
  const activeProject = useActiveProject();

  const goToHome = (e: React.MouseEvent) =>
    navigateTo(siteMap.home.path, undefined, e);

  if (!hasLoadedProjects) return null;

  return (
    <Box className="view-page" sx={sx}>
      {activeProject?.uuid ? (
        children
      ) : (
        <div>
          <p className="push-down">{message}</p>
          <Button
            variant="contained"
            onClick={goToHome}
            onAuxClick={goToHome}
            startIcon={<AddIcon />}
            autoFocus
          >
            Create your first project!
          </Button>
        </div>
      )}
    </Box>
  );
};

export default ProjectBasedView;
