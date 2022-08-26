import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import Stack from "@mui/material/Stack";
import React from "react";
import { useSaveEnvironmentChanges } from "../hooks/useSaveEnvironmentChanges";
import { useUpdateBuildStatusInEnvironmentChanges } from "../hooks/useUpdateBuildStatusInEnvironmentChanges";
import { useLoadSelectedBaseImage } from "./hooks/useLoadSelectedBaseImage";
import { NoEnvironment } from "./NoEnvironment";

type EditEnvironmentContainerProps = {
  children: React.ReactNode;
};

export const EditEnvironmentContainer = ({
  children,
}: EditEnvironmentContainerProps) => {
  // Gather all side effects here to ensure that they are triggered on mount,
  // and prevent unnecessary re-render on children.
  useLoadSelectedBaseImage();
  useSaveEnvironmentChanges();
  useUpdateBuildStatusInEnvironmentChanges();

  const hasNoEnvironment = useEnvironmentsApi(
    (state) => state.environments?.length === 0
  );

  return hasNoEnvironment ? (
    <NoEnvironment />
  ) : (
    <Stack
      direction="column"
      spacing={3}
      sx={{ paddingBottom: (theme) => theme.spacing(6) }}
    >
      {children}
    </Stack>
  );
};
