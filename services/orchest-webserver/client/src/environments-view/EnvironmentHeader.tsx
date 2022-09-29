import Stack from "@mui/material/Stack";
import React from "react";
import { BuildEnvironmentButton } from "./BuildEnvironmentButton";
import { BuildStatusAlert } from "./edit-environment/BuildStatusAlert";
import { EnvironmentName } from "./edit-environment/EnvironmentName";
import { EnvironmentMoreOptions } from "./EnvironmentMoreOptions";

export const EnvironmentHeader = () => {
  return (
    <Stack direction="column" spacing={3} paddingBottom={2}>
      <Stack direction="row" spacing={2}>
        <EnvironmentName />
        <BuildEnvironmentButton />
        <EnvironmentMoreOptions />
      </Stack>
      <BuildStatusAlert />
    </Stack>
  );
};
