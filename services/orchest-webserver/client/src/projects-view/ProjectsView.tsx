import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ExampleList } from "./ExampleList";
import { useFetchExamples } from "./hooks/useFetchExamples";
import { useFetchProjectsForProjectsView } from "./hooks/useFetchProjectsForProjectsView";
import { ImportDialog } from "./ImportDialog";
import { ProjectList } from "./ProjectList";
import { ProjectTabPanel } from "./ProjectTabPanel";
import { TempLayout } from "./TempLayout";

const projectTabs = ["My projects", "Example projects"];

export enum PROJECT_TAB {
  "MY_PROJECTS" = 0,
  "EXAMPLE_PROJECTS" = 1,
}

export const ProjectsView = () => {
  const { state } = useAppContext();
  useSendAnalyticEvent("view:loaded", { name: siteMap.projects.path });

  const {
    state: { projects },
  } = useProjectsContext();
  const { tab = "0" } = useCustomRoute();

  const { fetchProjects } = useFetchProjectsForProjectsView();

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
    if (state.hasCompletedOnboarding && importUrl !== "") {
      setIsImportDialogOpen(true);
    }
  }, [importUrl, state.hasCompletedOnboarding]);

  const [projectTabIndex, setProjectTabIndex] = React.useState<PROJECT_TAB>(
    parseInt(tab)
  );
  const onClickTab = React.useCallback((tabIndex: number) => {
    setProjectTabIndex(tabIndex);
  }, []);

  const { data: examples = [] } = useFetchExamples();
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
        projects={projects || []}
        open={isShowingCreateModal}
        onClose={onCloseCreateProjectModal}
      />
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ marginBottom: (theme) => theme.spacing(1) }}
      >
        <Typography variant="h4">Projects</Typography>
        <Stack direction="row" spacing={2}>
          {projectTabIndex === PROJECT_TAB.MY_PROJECTS && (
            <>
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
            </>
          )}
          {projectTabIndex === PROJECT_TAB.EXAMPLE_PROJECTS && (
            <Button
              variant="contained"
              endIcon={<LaunchOutlinedIcon />}
              onClick={navigateToOrchestExampleRepo}
              data-test-id="submit-example"
            >
              Submit example
            </Button>
          )}
        </Stack>
      </Stack>
      <Tabs
        value={projectTabIndex}
        aria-label="Projects tabs"
        sx={{ borderBottom: (theme) => `1px solid ${theme.borderColor}` }}
      >
        {projectTabs.map((projectTab, index) => {
          return (
            <Tab
              key={projectTab}
              label={projectTab}
              aria-label={projectTab}
              sx={{
                minWidth: (theme) => theme.spacing(24),
                paddingLeft: (theme) => theme.spacing(1),
                paddingRight: (theme) => theme.spacing(1),
              }}
              onClick={() => onClickTab(index)}
              onAuxClick={() => onClickTab(index)}
            />
          );
        })}
      </Tabs>
      <ProjectTabPanel
        id="projects"
        value={projectTabIndex}
        index={PROJECT_TAB.MY_PROJECTS}
        sx={{ padding: (theme) => theme.spacing(4, 0) }}
      >
        <ProjectList refetch={fetchProjects} />
      </ProjectTabPanel>
      <ProjectTabPanel
        id="example-projects"
        value={projectTabIndex}
        index={PROJECT_TAB.EXAMPLE_PROJECTS}
      >
        {isShowingWarning && (
          <Alert severity="warning" tabIndex={-1} onClose={dismissWarning}>
            Warning: Unverified community content has not been checked by
            Orchest and could contain malicious code.
          </Alert>
        )}
        <ExampleList data={examples} imporProject={importWithUrl} />
      </ProjectTabPanel>
    </TempLayout>
  );
};
