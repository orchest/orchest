import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { EditJobOverview } from "./EditJobOverview";
import { JobEnvVariables } from "./JobEnvVariables";
import { JobParameters } from "./JobParameters";
import { JobRuns } from "./JobRuns";
import { JobSummary } from "./JobSummary";
import { JobViewContainer } from "./JobViewContainer";
import { JobViewHeader } from "./JobViewHeader";
import { WebhookHint } from "./WebhookHint";

export const JobView = () => {
  const isEditing = useEditJob((state) => state.isEditing);
  const { jobUuid } = useCustomRoute();

  return (
    <JobViewContainer>
      <JobViewHeader />
      {!isEditing && <JobSummary />}
      {!isEditing && jobUuid && <JobRuns />}
      {isEditing && <EditJobOverview />}
      <JobParameters />
      <JobEnvVariables />
      <WebhookHint />
    </JobViewContainer>
  );
};
