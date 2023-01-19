import { Layout } from "@/components/layout/Layout";
import { MainSidePanel } from "@/components/layout/MainSidePanel";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCurrentQuery } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import { PipelineContextProviders } from "./contexts/PipelineContextProviders";
import { FileManager } from "./file-manager/FileManager";
import { FilePreview } from "./FilePreview";
import { PipelineEditor } from "./PipelineEditor";
import { PipelineFullScreenDialogs } from "./PipelineFullScreenDialogs";
import { SessionsPanel } from "./sessions-panel/SessionsPanel";

const PipelineView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.pipeline.path });
  const { projectUuid } = useCurrentQuery();
  const { pipelineReadOnlyReason } = useProjectsContext().state;
  const { path } = useRouteMatch();

  return (
    <Layout disablePadding={hasValue(projectUuid)}>
      {projectUuid ? (
        <PipelineContextProviders>
          <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
            <MainSidePanel>
              <FileManager />
              {!pipelineReadOnlyReason && <SessionsPanel />}
            </MainSidePanel>
            {path.endsWith("/file-preview") ? (
              <FilePreview />
            ) : (
              <PipelineEditor />
            )}
          </Stack>

          <PipelineFullScreenDialogs />
        </PipelineContextProviders>
      ) : (
        <ProjectBasedView />
      )}
    </Layout>
  );
};

export default PipelineView;
