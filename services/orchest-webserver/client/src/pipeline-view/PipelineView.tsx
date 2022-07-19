import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { FullScreenDialogHolder } from "./components/FullScreenDialogHolder";
import { PipelineContextProviders } from "./contexts/PipelineContextProviders";
import { FileManager } from "./file-manager/FileManager";
import { MainSidePanel } from "./MainSidePanel";
import { PipelineFileName } from "./pipeline-canvas-header-bar/PipelineFileName";
import { PipelineLogs } from "./pipeline-logs-dialog/PipelineLogs";
import { PipelineEditor } from "./PipelineEditor";
import { SessionsPanel } from "./sessions-panel/SessionsPanel";

const PipelineView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.pipeline.path });
  const {
    state: { pipelineIsReadOnly, projectUuid, pipeline },
  } = useProjectsContext();

  const displayFileName = pipeline?.path.replace(/\.orchest$/, "");
  const fileName = displayFileName ? (
    <Stack direction="row" alignItems="baseline">
      <Typography
        variant="h5"
        sx={{ marginRight: (theme) => theme.spacing(1) }}
      >
        Logs:
      </Typography>
      <PipelineFileName />
    </Stack>
  ) : null;

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
          <FullScreenDialogHolder dialogId="logs" title={fileName}>
            <PipelineLogs />
          </FullScreenDialogHolder>
        </PipelineContextProviders>
      ) : (
        <ProjectBasedView />
      )}
    </Layout>
  );
};

export default PipelineView;
