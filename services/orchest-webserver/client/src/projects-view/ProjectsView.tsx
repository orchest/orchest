import { useAppContext } from "@/contexts/AppContext";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import AddIcon from "@mui/icons-material/Add";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { ActionButtonsContainer } from "./ActionButtonsContainer";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ExampleList } from "./ExampleList";
import { ImportDialog } from "./ImportDialog";
import { ProjectList } from "./ProjectList";
import { ProjectsTabs } from "./ProjectsTabs";
import { ProjectTabPanel } from "./ProjectTabPanel";
import { ProjectTabsContextProvider, PROJECT_TAB } from "./ProjectTabsContext";
import { TempLayout } from "./TempLayout";

export const ProjectsView = () => {
  const {
    state: { hasCompletedOnboarding },
  } = useAppContext();
  useSendAnalyticEvent("view:loaded", { name: siteMap.projects.path });

  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);

  const onCreateClick = () => {
    setIsShowingCreateModal(true);
  };

  const onCloseCreateProjectModal = () => {
    setIsShowingCreateModal(false);
  };

  const onImport = () => {
    setIsImportDialogOpen(true);
  };

  const importWithUrl = (url: string) => {
    setImportUrl(url);
    setIsImportDialogOpen(true);
  };

  const [importUrl, setImportUrl] = useImportUrlFromQueryString();
  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (hasCompletedOnboarding && importUrl !== "") {
      setIsImportDialogOpen(true);
    }
  }, [importUrl, hasCompletedOnboarding]);

  const navigateToOrchestExampleRepo = () => {
    window.open(
      "https://github.com/orchest/orchest-examples",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const [isShowingWarning, setIsShowingWarning] = useLocalStorage(
    "example-warning",
    true
  );

  const dismissWarning = () => setIsShowingWarning(false);

  return (
    <TempLayout>
      <ImportDialog
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        confirmButtonLabel={`Save & view`}
      />
      <CreateProjectDialog
        open={isShowingCreateModal}
        onClose={onCloseCreateProjectModal}
      />
      <ProjectTabsContextProvider>
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
                startIcon={<DownloadOutlinedIcon />}
                onClick={onImport}
                data-test-id="import-project"
              >
                Import
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onCreateClick}
                data-test-id="add-project"
              >
                New project
              </Button>
            </ActionButtonsContainer>
            <ActionButtonsContainer
              projectTabIndex={PROJECT_TAB.EXAMPLE_PROJECTS}
            >
              <Button
                variant="contained"
                endIcon={<LaunchOutlinedIcon />}
                onClick={navigateToOrchestExampleRepo}
                data-test-id="submit-example"
              >
                Submit example
              </Button>
            </ActionButtonsContainer>
          </Stack>
        </Stack>
        <ProjectsTabs />
        <ProjectTabPanel
          id="projects"
          index={PROJECT_TAB.MY_PROJECTS}
          sx={{ padding: (theme) => theme.spacing(4, 0) }}
        >
          <ProjectList />
        </ProjectTabPanel>
        <ProjectTabPanel
          id="example-projects"
          index={PROJECT_TAB.EXAMPLE_PROJECTS}
        >
          {isShowingWarning && (
            <Alert severity="warning" tabIndex={-1} onClose={dismissWarning}>
              Warning: Unverified community content has not been checked by
              Orchest and could contain malicious code.
            </Alert>
          )}
          <ExampleList importProject={importWithUrl} />
        </ProjectTabPanel>
      </ProjectTabsContextProvider>
    </TempLayout>
  );
};
