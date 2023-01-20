import { SnackBar } from "@/components/common/SnackBar";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useOnBrowserTabFocus } from "@/hooks/useOnTabFocus";
import Button from "@mui/material/Button";
import blue from "@mui/material/colors/blue";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ProjectsEmptyState } from "./components/ProjectsEmptyState";
import { ProjectTable } from "./components/ProjectTable";

export const ProjectsTab = () => {
  const { isLoaded, isLoading, isEmpty, error, reload } = useFetchProjects();

  useOnBrowserTabFocus(reload);

  return (
    <>
      {isLoaded && isEmpty && <ProjectsEmptyState />}
      {!isEmpty && <ProjectTable />}
      <SnackBar
        open={hasValue(error)}
        message="Failed to fetch projects"
        action={
          <Button
            sx={{ color: blue[200] }}
            onClick={reload}
            disabled={isLoading}
          >
            Retry
          </Button>
        }
      />
    </>
  );
};
