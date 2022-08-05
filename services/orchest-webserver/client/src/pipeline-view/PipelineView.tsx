import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { InteractiveRunsContextProvider } from "./contexts/InteractiveRunsContext";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineDataContextProvider } from "./contexts/PipelineDataContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { FileManager } from "./file-manager/FileManager";
import { FileManagerContextProvider } from "./file-manager/FileManagerContext";
import { MainSidePanel } from "./MainSidePanel";
import { PipelineEditor } from "./PipelineEditor";
import { SessionsPanel } from "./sessions-panel/SessionsPanel";

const PipelineView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.pipeline.path });
  const {
    state: { pipelineIsReadOnly, projectUuid, pipeline },
  } = useProjectsContext();

  const { jobUuid, runUuid } = useCustomRoute();

  return (
    <Layout disablePadding={hasValue(projectUuid)}>
      {projectUuid ? (
        <PipelineDataContextProvider>
          <InteractiveRunsContextProvider>
            <PipelineEditorContextProvider>
              <FileManagerContextProvider
                projectUuid={projectUuid}
                pipelineUuid={pipeline?.uuid}
                jobUuid={jobUuid}
                runUuid={runUuid}
              >
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
          </InteractiveRunsContextProvider>
        </PipelineDataContextProvider>
      ) : (
        <ProjectBasedView />
      )}
    </Layout>
  );
};

export default PipelineView;
