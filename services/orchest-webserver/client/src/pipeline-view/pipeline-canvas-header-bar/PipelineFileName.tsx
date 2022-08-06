import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { basename } from "@/utils/path";
import { ellipsis } from "@/utils/styles";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

const BackToJob = () => {
  const { navigateTo } = useCustomRoute();
  const {
    isJobRun,
    job,
    projectUuid,
    pipelineUuid,
    jobUuid,
  } = usePipelineDataContext();

  const goToJob = (e: React.MouseEvent) =>
    navigateTo(
      siteMap.job.path,
      { query: { projectUuid, pipelineUuid, jobUuid } },
      e
    );

  if (!isJobRun) return null;
  return isJobRun && job ? (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Tooltip title={`Job: ${job.name}`} placement="bottom-start">
        <Link
          underline="hover"
          onClick={goToJob}
          onAuxClick={goToJob}
          sx={{
            cursor: "pointer",
            color: (theme) => theme.palette.grey[700],
            // fontWeight: (theme) => theme.typography.caption.fontWeight,
          }}
          variant="subtitle2"
        >
          {job?.name}
        </Link>
      </Tooltip>
      <Typography variant="caption">/</Typography>
    </Stack>
  ) : null;
};

export const PipelineFileName = () => {
  const {
    state: { pipeline },
  } = useProjectsContext();

  const { path = "" } = pipeline || {};

  const fileNameWithoutExtension = React.useMemo(
    () => basename(path).replace(/\.orchest$/, ""),
    [path]
  );

  return fileNameWithoutExtension ? (
    <Stack direction="row" spacing={1} alignItems="baseline" width="inherit">
      <BackToJob />
      <Tooltip title={`Project files/${path}`} placement="bottom-start">
        <Stack direction="row" alignItems="baseline" width="inherit">
          <Typography component="h2" variant="h5" sx={ellipsis()}>
            {fileNameWithoutExtension}
          </Typography>
          <Typography variant="subtitle2">.orchest</Typography>
        </Stack>
      </Tooltip>
    </Stack>
  ) : null;
};
