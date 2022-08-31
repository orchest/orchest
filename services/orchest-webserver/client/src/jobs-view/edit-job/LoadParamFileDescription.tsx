import { useJobsApi } from "@/api/jobs/useJobsApi";
import { pipelinePathToJsonLocation } from "@/utils/webserver-utils";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { useGetJobData } from "../hooks/useGetJobData";

export const LoadParamFileDescription = () => {
  const jobData = useGetJobData();

  const paramStrategyFilePath = pipelinePathToJsonLocation(
    jobData?.pipeline_run_spec.run_config.pipeline_path
  );

  const hasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );

  return (
    <Tooltip
      title={
        <Typography variant="caption" component="span">
          {hasLoadedParameterStrategyFile ? (
            <>
              {`Loaded job parameters file: `}
              <strong>{paramStrategyFilePath}</strong>
            </>
          ) : (
            <>
              Select a <strong>.parameters.json</strong> file to specify job
              parameters
            </>
          )}
          {` (`}
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.orchest.io/en/stable/fundamentals/jobs.html#specify-job-parameters-with-a-file"
            sx={{ color: (theme) => theme.palette.primary.light }}
          >
            see docs
          </Link>
          ).
        </Typography>
      }
      placement="right"
      arrow
    >
      <InfoOutlinedIcon
        fontSize="small"
        color="primary"
        style={{ width: "24px", height: "24px" }}
      />
    </Tooltip>
  );
};
