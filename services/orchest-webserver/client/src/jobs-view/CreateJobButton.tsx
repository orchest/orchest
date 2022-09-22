import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { pickJobChanges } from "./common";
import { useCreateJob } from "./hooks/useCreateJob";
import { useUnsavedChangesWarning } from "./hooks/useUnsavedChangesWarning";

type CreateJobButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
> & {
  onCreated: (uuids: string) => void;
};

export const CreateJobButton = ({
  onCreated,
  ...props
}: CreateJobButtonProps) => {
  const { projectUuid } = useCustomRoute();
  const { createJob, canCreateJob, pipeline } = useCreateJob();

  const { withConfirmation } = useUnsavedChangesWarning();

  const onCreate = React.useCallback(async () => {
    if (!pipeline) return;
    const newJob = await createJob();
    const changes = pickJobChanges(newJob);
    if (projectUuid && newJob && changes) {
      onCreated(newJob.uuid);
    }
  }, [createJob, onCreated, pipeline, projectUuid]);

  return (
    <CreateEntityButton
      onClick={() => withConfirmation(onCreate)}
      disabled={!canCreateJob}
      {...props}
    >
      New job
    </CreateEntityButton>
  );
};
