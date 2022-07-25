import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { Alert, AlertTitle } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";

const generateReadOnlyMessage = (jobName: string | undefined) =>
  jobName ? (
    <>
      {`This is a read-only pipeline snapshot from `}
      <b>{jobName}</b>
      {` job. Make edits in the Pipeline editor.`}
    </>
  ) : null;

export const ReadOnlyBanner = () => {
  const { navigateTo } = useCustomRoute();

  const {
    job,
    isReadOnly,
    isJobRun,
    projectUuid,
    pipelineUuid,
    pipeline,
  } = usePipelineDataContext();

  const goToPipeline = (e: React.MouseEvent) => [
    navigateTo(
      siteMap.pipeline.path,
      { query: { projectUuid, pipelineUuid } },
      e
    ),
  ];

  const isShowing =
    isJobRun && isReadOnly && hasValue(job) && hasValue(pipeline);

  return isShowing ? (
    <Box
      className="pipeline-actions"
      sx={{ padding: (theme) => theme.spacing(2.5) }}
    >
      <Alert
        action={
          <Button
            sx={{ cursor: "pointer", whiteSpace: "nowrap" }}
            onClick={goToPipeline}
            onAuxClick={goToPipeline}
          >
            OPEN IN EDITOR
          </Button>
        }
        color="info"
        icon={<VisibilityIcon />}
        sx={{
          width: "100%",
          ".MuiAlert-message": { width: "100%" },
        }}
      >
        <AlertTitle sx={{ width: "100%" }}>
          Read-only: pipeline snapshot
        </AlertTitle>
        {generateReadOnlyMessage(job.name)}
      </Alert>
    </Box>
  ) : null;
};
