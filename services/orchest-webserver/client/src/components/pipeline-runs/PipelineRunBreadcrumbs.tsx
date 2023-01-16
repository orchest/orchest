import { useJobsApi } from "@/api/jobs/useJobsApi";
import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { useActiveJob } from "@/jobs-view/job-view/hooks/useActiveJob";
import { JobRun, PipelineRun } from "@/types";
import { basename } from "@/utils/path";
import { isJobRun } from "@/utils/pipeline-run";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography, { TypographyProps } from "@mui/material/Typography";
import React from "react";
import { RouteLink, RouteLinkProps } from "../RouteLink";

export type PipelineRunBreadcrumbsProps = {
  run: PipelineRun;
  variant?: TypographyProps["variant"];
  color?: RouteLinkProps["color"];
};

export const PipelineRunBreadcrumbs = ({
  run,
  ...props
}: PipelineRunBreadcrumbsProps) => {
  if (isJobRun(run)) {
    return <JobRunBreadcrumbs run={run} {...props} />;
  } else {
    return <InteractiveRunBreadcrumbs run={run} {...props} />;
  }
};

export type JobRunBreadcrumbsProps = PipelineRunBreadcrumbsProps & {
  run: JobRun;
};

const JobRunBreadcrumbs = ({
  run,
  color = "inherit",
  variant = "body2",
}: JobRunBreadcrumbsProps) => {
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
      <Typography variant={variant}>{projectName}</Typography>
      <RouteLink
        to={pipelineLink}
        color={color}
        variant={variant}
        underline="hover"
      >
        {pipelineName}
      </RouteLink>
      <RouteLink to={jobLink} color={color} variant={variant} underline="hover">
        {job.name}
      </RouteLink>
    </Breadcrumbs>
  );
};

const InteractiveRunBreadcrumbs = ({
  run,
  color = "inherit",
  variant = "body2",
}: PipelineRunBreadcrumbsProps) => {
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
      <Typography variant={variant} color={color}>
        {basename(project.path)}
      </Typography>
      <RouteLink
        to={pipelineLink}
        color={color}
        variant={variant}
        underline="hover"
      >
        {basename(pipeline.path)}
      </RouteLink>
    </Breadcrumbs>
  );
};
