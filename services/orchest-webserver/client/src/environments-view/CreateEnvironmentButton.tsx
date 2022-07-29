import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import React from "react";
import { useCreateEnvironment } from "./stores/useCreateEnvironment";

type CreateEnvironmentButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
>;

export const CreateEnvironmentButton = (
  props: CreateEnvironmentButtonProps
) => {
  const { createEnvironment, isAllowedToCreate } = useCreateEnvironment();

  return (
    <CreateEntityButton
      onClick={createEnvironment}
      disabled={!isAllowedToCreate}
      {...props}
    >
      New environment
    </CreateEntityButton>
  );
};
