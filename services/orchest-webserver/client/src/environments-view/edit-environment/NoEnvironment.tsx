import { EmptyState } from "@/components/common/EmptyState";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Button from "@mui/material/Button";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { useCreateEnvironment } from "../hooks/useCreateEnvironment";
import { useSelectEnvironment } from "../hooks/useSelectEnvironment";

export const NoEnvironment = (props: StackProps) => {
  const { createEnvironment, canCreateEnvironment } = useCreateEnvironment();
  const selectEnvironment = useSelectEnvironment();

  const create = (event: React.MouseEvent) =>
    createEnvironment().then(
      (environment) => environment && selectEnvironment(event, environment.uuid)
    );

  return (
    <Stack justifyContent="center" alignItems="center" sx={{ height: "100%" }}>
      <EmptyState
        imgSrc="/image/no-environment.svg"
        title="No Environments"
        description={`Environments define the conditions in which Pipeline steps execute scripts and kernels.`}
        docPath="/fundamentals/environments.html"
        actions={
          <Button
            variant="contained"
            onClick={create}
            disabled={!canCreateEnvironment}
            startIcon={<AddOutlined />}
          >
            New environment
          </Button>
        }
        {...props}
      />
    </Stack>
  );
};
