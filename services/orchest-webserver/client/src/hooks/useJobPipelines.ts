import { useJobsApi } from "@/api/jobs/useJobsApi";
import { JobData, PipelineMetaData } from "@/types";
import { uniquePipelineId } from "@/utils/pipeline";
import React from "react";

const toPipelineMetadata = (job: JobData): PipelineMetaData => ({
  name: job.pipeline_name,
  uuid: job.pipeline_uuid,
  project_uuid: job.project_uuid,
  path: job.pipeline_run_spec.run_config.pipeline_path,
});

/**
 * Returns pipeline metadata for pipelines found in jobs.
 * Note: This may return pipelines that have been deleted
 * after the job was created.
 */
export const useJobPipelines = () => {
  const jobs = useJobsApi((api) => api.jobs);
  const jobPipelines = React.useMemo(
    () =>
      Object.values(
        Object.fromEntries(
          Object.values(jobs ?? {})
            .sort((left, right) =>
              left.created_time.localeCompare(right.created_time)
            )
            .map(toPipelineMetadata)
            .map((pipeline) => [uniquePipelineId(pipeline), pipeline])
        )
      ),
    [jobs]
  );

  return jobPipelines;
};
