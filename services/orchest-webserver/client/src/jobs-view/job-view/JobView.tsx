import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { useJob } from "../hooks/useJob";
import { useEditJob } from "../stores/useEditJob";
import { EditJobOverview } from "./EditJobOverview";
import { JobEnvVariables } from "./JobEnvVariables";
import { JobParameters } from "./JobParameters";
import { JobRuns } from "./JobRuns";
import { JobSummary } from "./JobSummary";
import { JobViewContainer } from "./JobViewContainer";
import { JobViewHeader } from "./JobViewHeader";

export const JobView = () => {
  const isEditing = useEditJob((state) => state.isEditing);
  const { jobUuid } = useCustomRoute();
  const { job } = useJob(jobUuid);

  return (
    <JobViewContainer>
      <JobViewHeader />
      {!isEditing && job && <JobSummary job={job} />}
      {!isEditing && job && <JobRuns job={job} />}
      {isEditing && <EditJobOverview />}
      <JobParameters />
      <JobEnvVariables />
    </JobViewContainer>
  );
};
