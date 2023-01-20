import { FullScreenDialog } from "@/components/FullScreenDialog";
import { PipelineRunLogs } from "@/components/pipeline-runs/PipelineRunLogs";
import { PipelineSettingsView } from "@/pipeline-settings-view/PipelineSettingsView";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { PipelineFileName } from "./pipeline-canvas-header-bar/PipelineFileName";

export const PipelineFullScreenDialogs = () => {
  const { fullscreenTab, setFullscreenTab } = usePipelineCanvasContext();
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  } = usePipelineDataContext();

  return (
    <>
      <FullScreenDialog
        open={fullscreenTab === "logs"}
        onClose={() => setFullscreenTab(undefined)}
        title={<FullScreenDialogHeader title="Logs" />}
      >
        <PipelineRunLogs
          projectUuid={projectUuid}
          pipelineUuid={pipelineUuid}
          jobUuid={jobUuid}
          runUuid={runUuid}
        />
      </FullScreenDialog>
      <FullScreenDialog
        open={
          hasValue(fullscreenTab) &&
          ["configuration", "environment-variables", "services"].includes(
            fullscreenTab
          )
        }
        onClose={() => setFullscreenTab(undefined)}
        title={<FullScreenDialogHeader title="Pipeline settings" />}
      >
        <PipelineSettingsView />
      </FullScreenDialog>
    </>
  );
};

type FullScreenDialogHeaderProps = { title: string };

const FullScreenDialogHeader = ({ title }: FullScreenDialogHeaderProps) => {
  return (
    <Stack direction="row" alignItems="baseline">
      <Typography
        variant="h5"
        sx={{ marginRight: (theme) => theme.spacing(1) }}
      >
        {title}:
      </Typography>
      <PipelineFileName hideBackToJob />
    </Stack>
  );
};
