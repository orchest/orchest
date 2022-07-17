import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { PipelineContextProviders } from "./contexts/PipelineContextProviders";
import { FileManager } from "./file-manager/FileManager";
import { MainSidePanel } from "./MainSidePanel";
import { PipelineEditor } from "./PipelineEditor";
import { SessionsPanel } from "./sessions-panel/SessionsPanel";

const PipelineView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.pipeline.path });
  const {
    state: { pipelineIsReadOnly, projectUuid },
  } = useProjectsContext();

  return (
    <Layout disablePadding={hasValue(projectUuid)}>
      {projectUuid ? (
        <PipelineContextProviders>
          <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
            <MainSidePanel>
              <FileManager />
              {!pipelineIsReadOnly && <SessionsPanel />}
            </MainSidePanel>
            <PipelineEditor />
          </Stack>
        </PipelineContextProviders>
      ) : (
        <ProjectBasedView />
      )}
    </Layout>
  );
};

export default PipelineView;
