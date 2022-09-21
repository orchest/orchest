import { Layout } from "@/components/Layout";
import { MainSidePanel } from "@/components/Layout/MainSidePanel";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { PipelineContextProviders } from "@/pipeline-view/contexts/PipelineContextProviders";
import { FileManager } from "@/pipeline-view/file-manager/FileManager";
import { SessionsPanel } from "@/pipeline-view/sessions-panel/SessionsPanel";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { PipelineEditor } from "../pipeline-view/PipelineEditor";

const PipelineView: React.FC = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.jobRun.path });
  const {
    state: { pipelineReadOnlyReason, projectUuid },
  } = useProjectsContext();
  return (
    <Layout disablePadding={hasValue(projectUuid)}>
      {projectUuid ? (
        <PipelineContextProviders>
          <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
            <MainSidePanel>
              <FileManager />
              {!pipelineReadOnlyReason && <SessionsPanel />}
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
