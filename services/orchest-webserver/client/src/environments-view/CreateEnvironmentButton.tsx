import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import React from "react";
import { useCreateEnvironment } from "./stores/useCreateEnvironment";

type CreateEnvironmentButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
> & {
  onCreated: (uuid: string) => void;
};

export const CreateEnvironmentButton = (
  props: CreateEnvironmentButtonProps
) => {
  const { createEnvironment, isAllowedToCreate } = useCreateEnvironment();
  const onCreate = async () => {
    const newEnvironment = await createEnvironment();
    if (newEnvironment) props.onCreated(newEnvironment.uuid);
  };

  return (
    <CreateEntityButton
      onClick={onCreate}
      disabled={!isAllowedToCreate}
      {...props}
    >
      New environment
    </CreateEntityButton>
  );
};
