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
  onCreated: (event: React.MouseEvent, uuid: string) => void;
};

export const CreateEnvironmentButton = ({
  onCreated,
  ...props
}: CreateEnvironmentButtonProps) => {
  const { createEnvironment, canCreateEnvironment } = useCreateEnvironment();
  const onCreate = async (event: React.MouseEvent) => {
    const newEnvironment = await createEnvironment();
    if (newEnvironment) onCreated(event, newEnvironment.uuid);
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
