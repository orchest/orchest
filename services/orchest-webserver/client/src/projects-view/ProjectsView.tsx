import { ViewLayout } from "@/components/layout/ViewLayout";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import React from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ExampleList } from "./ExampleList";
import { ImportDialog } from "./ImportDialog";
import { ImportSuccessDialog } from "./ImportSuccessDialog";
import { NoProject } from "./NoProject";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectsTable } from "./ProjectsTable";
import { ProjectsTabs } from "./ProjectsTabs";
import { ProjectTabPanel } from "./ProjectTabPanel";
import { ProjectTabsContextProvider, PROJECT_TAB } from "./ProjectTabsContext";

export const ProjectsView = () => {
  const {
    state: { hasCompletedOnboarding },
  } = useGlobalContext();
  const { projects, isLoaded } = useFetchProjects({
    skipDiscovery: false,
    activeJobCounts: true,
    sessionCounts: false,
  });
  const { navigateTo } = useCustomRoute();
  useSendAnalyticEvent("view:loaded", { name: siteMap.projects.path });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);

  const openCreateDialog = () => setIsCreateDialogOpen(true);
  const closeCreateDialog = () => setIsCreateDialogOpen(false);
  const openImportDialog = () => setIsImportDialogOpen(true);

  const [importUrl, setImportUrl] = useImportUrlFromQueryString();
  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (hasCompletedOnboarding && importUrl !== "") {
      setIsImportDialogOpen(true);
    }
  }, [importUrl, hasCompletedOnboarding]);

  const [isShowingWarning, setIsShowingWarning] = useLocalStorage(
    "example-warning",
    true
  );

  const dismissWarning = () => setIsShowingWarning(false);

  const [importWhenOpen, setImportWhenOpen] = React.useState(false);
  const [newProject, setNewProject] = React.useState<
    Pick<Project, "uuid" | "path">
  >();

  const [
    isOpenImportExampleSuccessDialog,
    setIsOpenImportExampleSuccessDialog,
  ] = React.useState(false);

  const importExample = (url: string) => {
    setImportUrl(url);
    setIsImportDialogOpen(true);
    setImportWhenOpen(true);
  };

  return (
    <>
      <ProjectTabsContextProvider>
        <ViewLayout
          header={({ scrolled }) => (
            <Stack spacing={3}>
              <ProjectsHeader
                onClickImport={openImportDialog}
                onClickCreate={openCreateDialog}
              />
              <ProjectsTabs
                style={scrolled ? { borderBottom: "none" } : undefined}
              />
            </Stack>
          )}
        >
          <ProjectTabPanel
            id="projects"
            index={PROJECT_TAB.MY_PROJECTS}
            sx={{ padding: (theme) => theme.spacing(2, 0) }}
          >
            {isLoaded && projects.length !== 0 && <ProjectsTable />}
            {isLoaded && projects.length === 0 && (
              <NoProject
                createProject={openCreateDialog}
                importProject={openImportDialog}
              />
            )}
          </ProjectTabPanel>
          <ProjectTabPanel
            id="example-projects"
            index={PROJECT_TAB.EXAMPLE_PROJECTS}
          >
            {isShowingWarning && (
              <Alert
                severity="warning"
                tabIndex={-1}
                onClose={dismissWarning}
                sx={{ marginTop: (theme) => theme.spacing(2) }}
              >
                Warning: Unverified community content has not been checked by
                Orchest and could contain malicious code.
              </Alert>
            )}
            <ExampleList importProject={importExample} />
          </ProjectTabPanel>
        </ViewLayout>
      </ProjectTabsContextProvider>

      <ImportDialog
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={(newProject) => {
          setImportWhenOpen(false);
          setIsImportDialogOpen(false);
          setIsOpenImportExampleSuccessDialog(true);
          setNewProject(newProject);
        }}
        importWhenOpen={importWhenOpen}
        confirmButtonLabel="Save"
      />
      <ImportSuccessDialog
        open={isOpenImportExampleSuccessDialog}
        projectName={newProject?.path || ""}
        viewPipeline={() => {
          if (newProject) {
            navigateTo(siteMap.pipeline.path, {
              query: { projectUuid: newProject.uuid },
            });
          }
        }}
        onClose={() => setIsOpenImportExampleSuccessDialog(false)}
      />
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onClose={closeCreateDialog}
      />
    </>
  );
};
