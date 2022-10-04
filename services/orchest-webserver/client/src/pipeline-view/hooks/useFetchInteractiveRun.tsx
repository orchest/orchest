import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetcher } from "@/hooks/useFetcher";
import { PipelineRun } from "@/types";
import { queryArgs } from "@/utils/text";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";

export const useFetchInteractiveRun = () => {
  const { projectUuid, pipelineUuid, runUuid: jobRunUuid } = useCustomRoute();
  // Edit mode fetches latest interactive run
  const shouldFetchRunUuid =
    !jobRunUuid && hasValue(projectUuid) && hasValue(pipelineUuid);

  const { data: latestRunUuid } = useFetcher<
    { runs: PipelineRun[] },
    string | undefined
  >(
    shouldFetchRunUuid
      ? `${PIPELINE_RUN_STATUS_ENDPOINT}?${queryArgs({
          projectUuid,
          pipelineUuid,
        })}`
      : undefined,
    { transform: (data) => data.runs[0]?.uuid }
  );

  const [runUuid, setRunUuid] = React.useState<string | undefined>(
    !shouldFetchRunUuid ? jobRunUuid : undefined
  );

  React.useEffect(() => {
    if (!runUuid && latestRunUuid) setRunUuid(latestRunUuid);
  }, [runUuid, latestRunUuid]);

  return { runUuid, setRunUuid };
};
