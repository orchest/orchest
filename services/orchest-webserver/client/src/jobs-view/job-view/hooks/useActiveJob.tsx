import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";

export const useActiveJob = () => {
  const { projectUuid, jobUuid } = useValidJobQueryArgs();
  const activeJob = useProjectJobsApi((state) =>
    state.projectUuid === projectUuid
      ? state.jobs?.find((job) => job.uuid === jobUuid)
      : undefined
  );

  return { activeJob };
};
