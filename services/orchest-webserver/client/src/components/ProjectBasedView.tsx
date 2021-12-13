import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import React from "react";

export interface IProjectBasedViewProps {
  projectUuid?: string;
}

const ProjectBasedView: React.FC<IProjectBasedViewProps> = ({
  projectUuid,
  children,
}) => {
  const { navigateTo } = useCustomRoute();

  const goToProjects = () => navigateTo(siteMap.projects.path);
  const message =
    "It looks like you don't have any projects yet! To get started using Orchest create your first project.";

  return (
    <div className="view-page">
      {projectUuid ? (
        children
      ) : (
        <div>
          <p className="push-down">{message}</p>
          <Button
            variant="contained"
            onClick={goToProjects}
            startIcon={<AddIcon />}
            type="submit"
          >
            Create your first project!
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProjectBasedView;
