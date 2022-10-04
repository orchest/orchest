import { EmptyState } from "@/components/common/EmptyState";
import { AddOutlined, DownloadOutlined } from "@mui/icons-material";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";

type NoProjectProps = {
  importProject: VoidFunction;
  createProject: VoidFunction;
};

export const NoProject = ({ importProject, createProject }: NoProjectProps) => {
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
            <Button
              variant="contained"
              onClick={createProject}
              startIcon={<AddOutlined />}
            >
              New project
            </Button>
            <Button onClick={importProject} startIcon={<DownloadOutlined />}>
              Import
            </Button>
          </>
        }
      />
    </Stack>
  );
};
