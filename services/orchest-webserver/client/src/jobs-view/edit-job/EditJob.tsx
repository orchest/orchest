import React from "react";
import { EditJobContainer } from "./EditJobContainer";
import { EditJobEnvVariables } from "./EditJobEnvVariables";
import { EditJobHeader } from "./EditJobHeader";
import { EditJobOverview } from "./EditJobOverview";
import { EditJobParameters } from "./EditJobParameters";

export const EditJob = () => {
  return (
    <EditJobContainer>
      <EditJobHeader />
      <EditJobOverview />
      <EditJobParameters />
      <EditJobEnvVariables />
    </EditJobContainer>
  );
};
