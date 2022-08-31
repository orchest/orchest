import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";
import { useEditJob } from "../stores/useEditJob";

export const useValidJobQueryArgs = () => {
  const {
    projectUuid: projectUuidFromRoute,
    jobUuid: jobUuidFromRoute,
  } = useCustomRoute();
  const projectUuid = useEditJob((state) => state.jobChanges?.project_uuid);
  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);

  const isValid =
    hasValue(projectUuid) &&
    projectUuid === projectUuidFromRoute &&
    hasValue(jobUuid) &&
    jobUuid === jobUuidFromRoute;

  return isValid ? { projectUuid, jobUuid } : {};
};
