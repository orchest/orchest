import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetcher } from "@/hooks/useFetcher";
import { PipelineRun } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";

export const useFetchInteractiveRun = () => {
  const { projectUuid, pipelineUuid, runUuid: jobRunUuid } = useCustomRoute();
  // Edit mode fetches latest interactive run
  const shouldFetchRunUuid =
    !jobRunUuid && hasValue(projectUuid) && hasValue(pipelineUuid);

  const {
    data: interactiveRunUuid,
    setData: setRunUuid,
    error: fetchRunUuidError,
    status,
  } = useFetcher<
    {
      runs: PipelineRun[];
    },
    string | undefined
  >(
    shouldFetchRunUuid
      ? `${PIPELINE_RUN_STATUS_ENDPOINT}/?project_uuid=${projectUuid}&pipeline_uuid=${pipelineUuid}`
      : undefined,
    { transform: (data) => data.runs[0]?.uuid }
  );

  return {
    runUuid: interactiveRunUuid || jobRunUuid,
    setRunUuid,
    fetchRunUuidError,
    isFetchingRunUuid: status === "PENDING",
  };
};
