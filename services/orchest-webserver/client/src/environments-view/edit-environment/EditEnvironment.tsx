import { EnvironmentImagesRadioGroup } from "@/environment-edit-view/EnvironmentImagesRadioGroup";
import { ellipsis } from "@/utils/styles";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { BuildEnvironmentButton } from "../BuildEnvironmentButton";
import { EnvironmentMoreOptions } from "../EnvironmentMoreOptions";
import { useGetEnvironments } from "../hooks/useGetEnvironments";
import { useSaveEnvironmentOnEdit } from "../hooks/useSaveEnvironmentOnEdit";
import { BuildStatusAlert } from "./BuildStatusAlert";
import { EnvironmentName } from "./EnvironmentName";
import { NoEnvironment } from "./NoEnvironment";

export const EditEnvironment = () => {
  const { environmentOnEdit } = useSaveEnvironmentOnEdit();
  const { environments } = useGetEnvironments();
  const hasNoEnvironment = environments?.length === 0;

  return hasNoEnvironment ? (
    <NoEnvironment />
  ) : (
    <Stack direction="column" spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" flex={1} sx={ellipsis()}>
          {environmentOnEdit?.name}
        </Typography>
        <BuildEnvironmentButton environmentOnEdit={environmentOnEdit} />
        <EnvironmentMoreOptions />
      </Stack>
      <BuildStatusAlert latestBuild={environmentOnEdit?.latestBuild} />
      <Typography component="h3" variant="h6">
        Properties
      </Typography>
      <EnvironmentName />
      <EnvironmentImagesRadioGroup />
    </Stack>
  );
};
