import { useAsync } from "@/hooks/useAsync";
import { PipelineJson } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

export const useFetchPipeline = (
  pipelineUuid: string,
  projectUuid: string,
  jobUuid?: string,
  pipelineRunUuid?: string
) => {
  const { data, run, status, error, setError } = useAsync<PipelineJson>();
  const pipelineJSONEndpoint = getPipelineJSONEndpoint(
    pipelineUuid,
    projectUuid,
    jobUuid,
    pipelineRunUuid
  );

  const fetchPipeline = React.useCallback(() => {
    run(
      fetcher<{
        pipeline_json: string;
        success: boolean;
      }>(pipelineJSONEndpoint).then((result) => {
        if (!result.success) {
          throw new Error("Failed to fetch pipeline.json");
        }
        return JSON.parse(result.pipeline_json) as PipelineJson;
      })
    );
  }, [pipelineJSONEndpoint, run]);

  React.useEffect(() => {
    if (pipelineJSONEndpoint) {
      try {
        fetchPipeline();
      } catch (err) {
        setError(`Unable to load pipeline: ${err}`);
      }
    }
  }, [pipelineJSONEndpoint, fetchPipeline, setError]);

  return { data, error, status };
};
