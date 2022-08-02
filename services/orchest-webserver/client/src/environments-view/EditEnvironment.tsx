import { ellipsis } from "@/utils/styles";
import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { EnvironmentMoreOptions } from "./EnvironmentMoreOptions";
import { NoEnvironment } from "./NoEnvironment";
import { useEditEnvironment } from "./stores/useEditEnvironment";
import { useGetEnvironments } from "./stores/useGetEnvironments";

const useHasEnvironment = () => {
  const { environments } = useGetEnvironments();
  const hasNoEnvironment = environments?.length === 0;

  return hasNoEnvironment;
};

export const EditEnvironment = () => {
  const { environment } = useEditEnvironment();
  const hasNoEnvironment = useHasEnvironment();

  return hasNoEnvironment ? (
    <NoEnvironment />
  ) : (
    <Stack direction="column">
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" flex={1} sx={ellipsis()}>
          {environment?.name}
        </Typography>
        <Button variant="contained" startIcon={<BuildCircleOutlinedIcon />}>
          Build
        </Button>
        <EnvironmentMoreOptions />
      </Stack>
    </Stack>
  );
};
