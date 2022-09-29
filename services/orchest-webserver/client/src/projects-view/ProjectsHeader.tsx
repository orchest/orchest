import AddOutlined from "@mui/icons-material/AddOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import LaunchOutlined from "@mui/icons-material/LaunchOutlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { ActionButtonsContainer } from "./ActionButtonsContainer";
import { PROJECT_TAB } from "./ProjectTabsContext";

export type ProjectsHeaderProps = {
  onClickImport: VoidFunction;
  onClickCreate: VoidFunction;
};

export const ProjectsHeader = ({
  onClickImport,
  onClickCreate,
}: ProjectsHeaderProps) => {
  const navigateToOrchestExampleRepo = () => {
    window.open(
      "https://github.com/orchest/orchest-examples",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ marginBottom: (theme) => theme.spacing(1) }}
    >
      <Typography variant="h4">Projects</Typography>
      <Stack direction="row" spacing={2}>
        <ActionButtonsContainer projectTabIndex={PROJECT_TAB.MY_PROJECTS}>
          <Button
            variant="text"
            startIcon={<DownloadOutlined />}
            onClick={onClickImport}
            data-test-id="import-project"
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={onClickCreate}
            data-test-id="add-project"
          >
            New project
          </Button>
        </ActionButtonsContainer>
        <ActionButtonsContainer projectTabIndex={PROJECT_TAB.EXAMPLE_PROJECTS}>
          <Button
            variant="contained"
            endIcon={<LaunchOutlined />}
            onClick={navigateToOrchestExampleRepo}
            data-test-id="submit-example"
          >
            Submit example
          </Button>
        </ActionButtonsContainer>
      </Stack>
    </Stack>
  );
};
