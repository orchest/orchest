import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import React from "react";
import { useCreateJob } from "./hooks/useCreateJob";

type CreateJobButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
> & {
  onCreated: (uuid: string) => void;
};

export const CreateJobButton = ({
  onCreated,
  ...props
}: CreateJobButtonProps) => {
  const { createEnvironment, isAllowedToCreate } = useCreateJob();
  const onCreate = async () => {
    const newEnvironment = await createEnvironment();
    if (newEnvironment) onCreated(newEnvironment.uuid);
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
