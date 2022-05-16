import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import AddIcon from "@mui/icons-material/Add";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React from "react";

export interface IProjectBasedViewProps {
  sx?: SxProps<Theme>;
}

const message =
  "It looks like you don't have any projects yet! To get started using Orchest create your first project.";

const ProjectBasedView: React.FC<IProjectBasedViewProps> = ({ children }) => {
  const { navigateTo } = useCustomRoute();
  const {
    state: { hasLoadedProjects, projectUuid },
  } = useProjectsContext();

  const goToProjects = (e: React.MouseEvent) =>
    navigateTo(siteMap.projects.path, undefined, e);

  return (
    <Box className="view-page">
      {!hasLoadedProjects ? null : projectUuid ? (
        children
      ) : (
        <div>
          <p className="push-down">{message}</p>
          <Button
            variant="contained"
            onClick={goToProjects}
            onAuxClick={goToProjects}
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
