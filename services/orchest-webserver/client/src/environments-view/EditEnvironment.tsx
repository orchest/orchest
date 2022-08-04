import { EnvironmentImageBuild } from "@/types";
import { ellipsis } from "@/utils/styles";
import Alert, { AlertProps } from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { BuildEnvironmentButton } from "./BuildEnvironmentButton";
import { isEnvironmentBuilding } from "./common";
import { EnvironmentMoreOptions } from "./EnvironmentMoreOptions";
import { NoEnvironment } from "./NoEnvironment";
import {
  useEnvironmentOnEdit,
  useSaveEnvironmentOnEdit,
} from "./stores/useEnvironmentOnEdit";
import { useGetEnvironments } from "./stores/useGetEnvironments";

const useHasEnvironment = () => {
  const { environments } = useGetEnvironments();
  const hasNoEnvironment = environments?.length === 0;

  return hasNoEnvironment;
};

type BuildStatusAlertProps = {
  latestBuild?: EnvironmentImageBuild;
};

const alertMessageMapping: Record<
  "FAILURE" | "SUCCUSS",
  { severity: AlertProps["severity"]; message: string }
> = {
  FAILURE: {
    severity: "error",
    message: "Build failed",
  },
  SUCCUSS: {
    severity: "success",
    message: "Build successful",
  },
};

const BuildStatusAlert = ({ latestBuild }: BuildStatusAlertProps) => {
  const alert = alertMessageMapping[latestBuild?.status || ""];
  return (
    <Collapse in={Boolean(alert)}>
      {hasValue(alert) && (
        <Alert severity={alert.severity}>{alert.message}</Alert>
      )}
    </Collapse>
  );
};

const EnvironmentName = () => {
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  return (
    <TextField
      required
      value={environmentOnEdit?.name || ""}
      onChange={(e) => {
        setEnvironmentOnEdit({ name: e.target.value });
      }}
      label="Environment name"
      autoFocus
      disabled={isEnvironmentBuilding(environmentOnEdit?.latestBuild)}
    />
  );
};

export const EditEnvironment = () => {
  const { environmentOnEdit } = useSaveEnvironmentOnEdit();
  const hasNoEnvironment = useHasEnvironment();

  return hasNoEnvironment ? (
    <NoEnvironment />
  ) : (
    <Stack direction="column" spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" flex={1} sx={ellipsis()}>
          {environmentOnEdit?.name}
        </Typography>
        <BuildEnvironmentButton environmentOnEdit={environmentOnEdit} />
        <EnvironmentMoreOptions />
      </Stack>
      <BuildStatusAlert latestBuild={environmentOnEdit?.latestBuild} />
      <Typography variant="body1">Properties</Typography>
      <EnvironmentName />
    </Stack>
  );
};
