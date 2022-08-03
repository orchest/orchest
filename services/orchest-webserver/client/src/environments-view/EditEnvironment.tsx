import { ellipsis } from "@/utils/styles";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { BuildEnvironmentButton } from "./BuildEnvironmentButton";
import { EnvironmentMoreOptions } from "./EnvironmentMoreOptions";
import { NoEnvironment } from "./NoEnvironment";
import { useSaveEnvironmentOnEdit } from "./stores/useEnvironmentOnEdit";
import { useGetEnvironments } from "./stores/useGetEnvironments";

const useHasEnvironment = () => {
  const { environments } = useGetEnvironments();
  const hasNoEnvironment = environments?.length === 0;

  return hasNoEnvironment;
};

export const EditEnvironment = () => {
  const { environmentOnEdit } = useSaveEnvironmentOnEdit();
  const hasNoEnvironment = useHasEnvironment();

  return hasNoEnvironment ? (
    <NoEnvironment />
  ) : (
    <Stack direction="column">
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" flex={1} sx={ellipsis()}>
          {environmentOnEdit?.name}
        </Typography>
        <BuildEnvironmentButton environmentOnEdit={environmentOnEdit} />
        <EnvironmentMoreOptions />
      </Stack>
    </Stack>
  );
};
