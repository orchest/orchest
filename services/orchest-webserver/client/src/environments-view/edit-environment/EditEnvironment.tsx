import { EnvironmentImagesRadioGroup } from "@/environments-view/edit-environment/EnvironmentImagesRadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { BuildEnvironmentButton } from "../BuildEnvironmentButton";
import { EnvironmentMoreOptions } from "../EnvironmentMoreOptions";
import { BuildStatusAlert } from "./BuildStatusAlert";
import { EditEnvironmentContainer } from "./EditEnvironmentContainer";
import { EditEnvironmentName } from "./EditEnvironmentName";
import { EnvironmentImageBuildLogs } from "./EnvironmentImageBuildLogs";
import { EnvironmentName } from "./EnvironmentName";
import { EnvironmentSetupScript } from "./EnvironmentSetupScript";

export const EditEnvironment = () => {
  return (
    <EditEnvironmentContainer>
      <Stack direction="row" spacing={2} alignItems="center">
        <EnvironmentName />
        <BuildEnvironmentButton />
        <EnvironmentMoreOptions />
      </Stack>
      <BuildStatusAlert />
      <Typography component="h5" variant="h6">
        Properties
      </Typography>
      <EditEnvironmentName />
      <EnvironmentImagesRadioGroup />
      <EnvironmentSetupScript />
      <EnvironmentImageBuildLogs />
    </EditEnvironmentContainer>
  );
};
