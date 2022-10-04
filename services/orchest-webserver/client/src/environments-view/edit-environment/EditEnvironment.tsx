import React from "react";
import { EditEnvironmentContainer } from "./EditEnvironmentContainer";
import { EnvironmentImageBuildLogs } from "./EnvironmentImageBuildLogs";
import { EnvironmentProperties } from "./EnvironmentProperties";
import { EnvironmentSetupScript } from "./EnvironmentSetupScript";

export const EditEnvironment = () => {
  return (
    <EditEnvironmentContainer>
      <EnvironmentProperties />
      <EnvironmentSetupScript />
      <EnvironmentImageBuildLogs />
    </EditEnvironmentContainer>
  );
};
