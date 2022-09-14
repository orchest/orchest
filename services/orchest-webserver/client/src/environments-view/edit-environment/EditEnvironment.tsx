import Stack from "@mui/material/Stack";
import React from "react";
import { BuildEnvironmentButton } from "../BuildEnvironmentButton";
import { EnvironmentMoreOptions } from "../EnvironmentMoreOptions";
import { BuildStatusAlert } from "./BuildStatusAlert";
import { EditEnvironmentContainer } from "./EditEnvironmentContainer";
import { EnvironmentImageBuildLogs } from "./EnvironmentImageBuildLogs";
import { EnvironmentName } from "./EnvironmentName";
import { EnvironmentProperties } from "./EnvironmentProperties";
import { EnvironmentSetupScript } from "./EnvironmentSetupScript";

export const EditEnvironment = () => {
  return (
    <EditEnvironmentContainer>
      <Stack
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: (theme) => theme.palette.background.paper,
          zIndex: 2,
          paddingTop: (theme) => theme.spacing(5),
        }}
        direction="column"
        spacing={3}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <EnvironmentName />
          <BuildEnvironmentButton />
          <EnvironmentMoreOptions />
        </Stack>
        <BuildStatusAlert />
      </Stack>
      <EnvironmentProperties />
      <EnvironmentSetupScript />
      <EnvironmentImageBuildLogs />
    </EditEnvironmentContainer>
  );
};
