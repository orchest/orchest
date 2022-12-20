import { EmptyState } from "@/components/common/EmptyState";
import Stack from "@mui/material/Stack";
import React from "react";
import { ImportProjectButton } from "./ImportProjectButton";
import { NewProjectButton } from "./NewProjectButton";

export const ProjectsEmptyState = () => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(6) }}
    >
      <EmptyState
        imgSrc="/image/no-project.svg"
        title="No Projects"
        description="Projects are the main container for organizing related Pipelines, Jobs, Environments and code."
        actions={
          <>
            <NewProjectButton data-test-id="projects-empty-state-new-project-button" />
            <ImportProjectButton
              showSuccessDialog={true}
              data-test-id="projects-empty-state-import-project-button"
            />
          </>
        }
      />
    </Stack>
  );
};
