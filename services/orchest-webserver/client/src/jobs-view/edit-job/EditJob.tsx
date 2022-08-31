import React from "react";
import { useUpdateJobOnUnmount } from "../hooks/useUpdateJobOnUnmount";
import { EditJobContainer } from "./EditJobContainer";
import { EditJobHeader } from "./EditJobHeader";
import { EditJobParameters } from "./EditJobParameters";
import { JobOverview } from "./JobOverview";

export const EditJob = () => {
  useUpdateJobOnUnmount();
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
