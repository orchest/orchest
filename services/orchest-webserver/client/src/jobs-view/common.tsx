import { JobChanges, JobChangesData, JobData } from "@/types";
import { pick } from "@/utils/record";

export const pickJobChangesData = (
  jobData?: JobData
): JobChangesData | undefined => {
  if (!jobData) return undefined;

  return pick(
    jobData,
    "uuid",
    "name",
    "parameters",
    "env_variables",
    "max_retained_pipeline_runs",
    "schedule"
  );
};

export const pickJobChanges = (jobData?: JobData): JobChanges | undefined => {
  if (!jobData) return undefined;

  return pick(
    jobData,
    "uuid",
    "name",
    "parameters",
    "env_variables",
    "max_retained_pipeline_runs",
    "schedule",
    "status",
    "project_uuid",
    "pipeline_uuid"
  );
};
