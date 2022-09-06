import React from "react";
import { JobEnvVariables } from "./JobEnvVariables";
import { JobOverview } from "./JobOverview";
import { JobParameters } from "./JobParameters";
import { JobViewContainer } from "./JobViewContainer";
import { JobViewHeader } from "./JobViewHeader";

export const JobView = () => {
  return (
    <JobViewContainer>
      <JobViewHeader />
      <JobOverview />
      <JobParameters />
      <JobEnvVariables />
    </JobViewContainer>
  );
};
