import React from "react";
import { EditJobContainer } from "./EditJobContainer";
import { EditJobHeader } from "./EditJobHeader";
import { EditJobParameters } from "./EditJobParameters";
import { JobOverview } from "./JobOverview";

export const EditJob = () => {
  return (
    <>
      <EditJobContainer>
        <EditJobHeader />
        <JobOverview />
        <EditJobParameters />
      </EditJobContainer>
    </>
  );
};
