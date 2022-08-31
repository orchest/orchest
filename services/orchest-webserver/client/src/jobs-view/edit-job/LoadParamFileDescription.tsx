import { useJobsApi } from "@/api/jobs/useJobsApi";
import { Code } from "@/components/common/Code";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { pipelinePathToJsonLocation } from "@/utils/webserver-utils";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useGetJobData } from "../hooks/useGetJobData";

export const LoadParamFileDescription = () => {
  const { navigateTo } = useCustomRoute();
  const jobData = useGetJobData();

  const projectUuid = jobData?.project_uuid;
  const pipelineUuid = jobData?.pipeline_uuid;
  const paramStrategyFilePath = pipelinePathToJsonLocation(
    jobData?.pipeline_run_spec.run_config.pipeline_path
  );

  const hasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );
  return (
    <Typography component="span" variant="caption">
      {hasLoadedParameterStrategyFile && hasValue(paramStrategyFilePath) && (
        <span>
          `Loaded job parameters file `<Code>{paramStrategyFilePath}</Code>.
        </span>
      )}
      {`You can generate this file in the `}
      <Link
        sx={{ cursor: "pointer" }}
        onClick={() => {
          navigateTo(siteMap.pipeline.path, {
            query: {
              projectUuid,
              pipelineUuid,
              tab: "configuration",
            },
          });
        }}
      >
        pipeline settings
      </Link>
      .
    </Typography>
  );
};
