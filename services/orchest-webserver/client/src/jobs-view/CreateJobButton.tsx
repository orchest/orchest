import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";
import { pickJobChangesData } from "./common";
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
  const { initJobChanges } = useEditJob();

  const pipeline = useGetValidPipeline();
  const { createJob, isAllowedToCreateJob } = useCreateJob(pipeline);

  const onCreate = async () => {
    if (!pipeline) return;
    const newJob = await createJob();
    const changes = pickJobChangesData(newJob);
    if (projectUuid && newJob && changes) {
      initJobChanges({
        ...changes,
        project_uuid: projectUuid,
        pipeline_uuid: pipeline.uuid,
        status: "DRAFT",
      });
      onCreated(`${newJob.project_uuid}|${newJob.uuid}`);
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
