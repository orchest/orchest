import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";

export const useActiveJob = () => {
  const { projectUuid, jobUuid } = useValidJobQueryArgs();
  const activeJob = useJobsApi((state) =>
    state.projectUuid === projectUuid
      ? state.jobs?.find((job) => job.uuid === jobUuid)
      : undefined
  );

  return { activeJob };
};
