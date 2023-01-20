import { RouteLink } from "@/components/RouteLink";
import { useActivePipeline } from "@/hooks/useActivePipeline";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { basename } from "@/utils/path";
import { ellipsis } from "@/utils/styles";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

const BackToJob = () => {
  const { isSnapshot, isJobRun, job, jobUuid } = usePipelineDataContext();
  const jobLink = useRouteLink({ route: "jobs", query: { jobUuid } });
  const isRunningOnSnapshot = isSnapshot || isJobRun;

  return isRunningOnSnapshot && job ? (
    <Stack direction="row" spacing={1} alignItems="baseline" flexShrink="0">
      <Tooltip title={`Job: ${job.name}`} placement="bottom-start">
        <RouteLink
          to={jobLink}
          underline="hover"
          variant="subtitle2"
          sx={{
            cursor: "pointer",
            color: (theme) => theme.palette.grey[700],
          }}
        >
          {job.name}
        </RouteLink>
      </Tooltip>
      <Typography variant="caption">/</Typography>
    </Stack>
  ) : null;
};

type PipelineFileNameProps = {
  hideBackToJob?: boolean;
};

export const PipelineFileName = ({ hideBackToJob }: PipelineFileNameProps) => {
  const pipeline = useActivePipeline();

  const { path = "" } = pipeline || {};

  const fileNameWithoutExtension = React.useMemo(
    () => basename(path).replace(/\.orchest$/, ""),
    [path]
  );

  return fileNameWithoutExtension ? (
    <Stack direction="row" spacing={1} alignItems="baseline" width="inherit">
      {!hideBackToJob && <BackToJob />}
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
