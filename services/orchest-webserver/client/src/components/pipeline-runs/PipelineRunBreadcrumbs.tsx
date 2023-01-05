import { useJobsApi } from "@/api/jobs/useJobsApi";
import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { useActiveJob } from "@/jobs-view/job-view/hooks/useActiveJob";
import { JobRun, PipelineRun } from "@/types";
import { basename } from "@/utils/path";
import { isJobRun } from "@/utils/pipeline-run";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import React from "react";
import { RouteLink } from "../RouteLink";

export type PipelineRunBreadcrumbsProps = { run: PipelineRun };

export const PipelineRunBreadcrumbs = ({
  run,
}: PipelineRunBreadcrumbsProps) => {
  if (isJobRun(run)) {
    return <JobRunBreadcrumbs run={run} />;
  } else {
    return <InteractiveRunBreadcrumbs run={run} />;
  }
};

export type JobRunBreadcrumbsProps = { run: JobRun };

const JobRunBreadcrumbs = ({ run }: JobRunBreadcrumbsProps) => {
  const firstJob = useJobsApi((api) =>
    isJobRun(run) ? api.jobs?.[run.job_uuid] : undefined
  );
  const { activeJob } = useActiveJob();
  const job = activeJob?.uuid === run.job_uuid ? activeJob : firstJob;

  const pipelineLink = useRouteLink({
    route: "jobRun",
    sticky: false,
    query: {
      projectUuid: run.project_uuid,
      pipelineUuid: run.pipeline_uuid,
      jobUuid: run.job_uuid,
      runUuid: run.uuid,
    },
  });

  const jobLink = useRouteLink({
    route: "jobs",
    sticky: false,
    query: {
      projectUuid: run.project_uuid,
      pipelineUuid: run.pipeline_uuid,
      jobUuid: run.job_uuid,
    },
  });

  if (!job) return null;

  const projectName = basename(job.pipeline_run_spec.run_config.project_dir);
  const pipelineName = basename(
    job.pipeline_run_spec.run_config.pipeline_path
  ).replace(/\.orchest$/, "");

  return (
    <Breadcrumbs>
      <Typography variant="body2">{projectName}</Typography>
      <RouteLink
        to={pipelineLink}
        color="inherit"
        variant="body2"
        underline="hover"
      >
        {pipelineName}
      </RouteLink>
      <RouteLink to={jobLink} color="inherit" variant="body2" underline="hover">
        {job.name}
      </RouteLink>
    </Breadcrumbs>
  );
};

const InteractiveRunBreadcrumbs = ({ run }: PipelineRunBreadcrumbsProps) => {
  const project = useProjectsApi((api) => api.projects?.[run.project_uuid]);
  const pipeline = usePipelinesApi((api) =>
    api.find(run.project_uuid, run.pipeline_uuid)
  );

  const pipelineLink = useRouteLink({
    route: "pipeline",
    sticky: false,
    query: {
      projectUuid: run.project_uuid,
      pipelineUuid: run.pipeline_uuid,
    },
  });

  if (!project || !pipeline) return null;

  return (
    <Breadcrumbs>
      <Typography variant="body2">{basename(project.path)}</Typography>
      <RouteLink
        to={pipelineLink}
        color="inherit"
        variant="body2"
        underline="hover"
      >
        {basename(pipeline.path)}
      </RouteLink>
    </Breadcrumbs>
  );
};
