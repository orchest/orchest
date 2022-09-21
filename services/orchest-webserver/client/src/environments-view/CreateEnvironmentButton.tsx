import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import React from "react";
import { useCreateEnvironment } from "./hooks/useCreateEnvironment";

type CreateEnvironmentButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
> & {
  onCreated: (uuid: string) => void;
};

export const CreateEnvironmentButton = ({
  onCreated,
  ...props
}: CreateEnvironmentButtonProps) => {
  const { createEnvironment, canCreateEnvironment } = useCreateEnvironment();
  const onCreate = async () => {
    const newEnvironment = await createEnvironment();
    if (newEnvironment) onCreated(newEnvironment.uuid);
  };

  return (
    <CreateEntityButton
      onClick={onCreate}
      disabled={!canCreateEnvironment}
      {...props}
    >
      New environment
    </CreateEntityButton>
  );
};
