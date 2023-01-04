import { SnackBar } from "@/components/common/SnackBar";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import Button from "@mui/material/Button";
import blue from "@mui/material/colors/blue";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ProjectsEmptyState } from "./components/ProjectsEmptyState";
import { ProjectTable } from "./components/ProjectTable";

export const ProjectsTab = () => {
  const { isFetched, isFetching, isEmpty, error, refresh } = useFetchProjects();

  return (
    <>
      {isFetched && isEmpty && <ProjectsEmptyState />}
      {!isEmpty && <ProjectTable />}
      <SnackBar
        open={hasValue(error)}
        message="Failed to fetch projects"
        action={
          <Button
            sx={{ color: blue[200] }}
            onClick={() => refresh()}
            disabled={isFetching}
          >
            Retry
          </Button>
        }
      />
    </>
  );
};
