import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { pickJobChanges } from "./common";
import { useCreateJob } from "./hooks/useCreateJob";
import { useEditJob } from "./stores/useEditJob";

type CreateJobButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
> & {
  onCreated: (uuids: string) => void;
};

// TODO: replace this with usePipelinesApi using zustand.
const useGetValidPipeline = () => {
  const {
    state: { pipelines = [], pipeline },
  } = useProjectsContext();

  const validPipeline = React.useMemo(() => {
    return pipeline || pipelines[0];
  }, [pipelines, pipeline]);

  return validPipeline;
};

export const CreateJobButton = ({
  onCreated,
  ...props
}: CreateJobButtonProps) => {
  const { projectUuid } = useCustomRoute();
  const initJobChanges = useEditJob((state) => state.initJobChanges);

  const pipeline = useGetValidPipeline();
  const { createJob, isAllowedToCreateJob } = useCreateJob(pipeline);

  const onCreate = async () => {
    if (!pipeline) return;
    const newJob = await createJob();
    const changes = pickJobChanges(newJob);
    if (projectUuid && newJob && changes) {
      initJobChanges(changes);
      onCreated(newJob.uuid);
    }
  };

  return (
    <CreateEntityButton
      onClick={onCreate}
      disabled={!isAllowedToCreateJob}
      {...props}
    >
      New job
    </CreateEntityButton>
  );
};
