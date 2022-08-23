import { JobChangesData, JobData } from "@/types";
import { pick } from "@/utils/record";

export const pickJobChanges = (
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
