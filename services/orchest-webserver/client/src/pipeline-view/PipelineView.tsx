import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { FileManager } from "./file-manager/FileManager";
import { FileManagerContextProvider } from "./file-manager/FileManagerContext";
import { MainSidePanel } from "./MainSidePanel";
import { PipelineEditor } from "./PipelineEditor";
import { SessionsPanel } from "./sessions-panel/SessionsPanel";

const PipelineView = () => {
  useSendAnalyticEvent("view load", { name: siteMap.pipeline.path });
  const { setIsDrawerOpen } = useAppContext();
  const {
    state: { pipelineIsReadOnly, projectUuid },
  } = useProjectsContext();

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsDrawerOpen(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [setIsDrawerOpen]);

  return (
    <Layout disablePadding={hasValue(projectUuid)}>
      {projectUuid ? (
        <PipelineEditorContextProvider>
          <FileManagerContextProvider>
            <PipelineCanvasContextProvider>
              <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
                <MainSidePanel>
                  <FileManager />
                  {!pipelineIsReadOnly && <SessionsPanel />}
                </MainSidePanel>
                <PipelineEditor />
              </Stack>
            </PipelineCanvasContextProvider>
          </FileManagerContextProvider>
        </PipelineEditorContextProvider>
      ) : (
        <ProjectBasedView />
      )}
    </Layout>
  );
};

export default PipelineView;
