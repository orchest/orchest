import { useValidQueryArgs } from "@/hooks/useValidQueryArgs";
import { useEditJob } from "../stores/useEditJob";

export const useValidJobQueryArgs = () => {
  const jobChangesProjectUuid = useEditJob(
    (state) => state.jobChanges?.project_uuid
  );
  const jobChangesJobUuid = useEditJob((state) => state.jobChanges?.uuid);

  const { projectUuid, jobUuid } = useValidQueryArgs({
    projectUuid: jobChangesProjectUuid,
    jobUuid: jobChangesJobUuid,
  });

  return { projectUuid, jobUuid };
};
