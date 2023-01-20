import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { mapRecord } from "@/utils/record";
import React from "react";
import { useHydrate } from "./useHydrate";

export const useFetchProjectPipelines = (projectUuid: string | undefined) => {
  const allPipelines = usePipelinesApi((api) => api.pipelines);
  const fetchForProject = usePipelinesApi((api) => api.fetchForProject);
  const hydrate = React.useCallback(async () => {
    return fetchForProject(projectUuid);
  }, [fetchForProject, projectUuid]);
  const state = useHydrate(hydrate, { rehydrate: true });

  const pipelines = React.useMemo(
    () =>
      mapRecord(
        (allPipelines ?? []).filter(
          (pipeline) => pipeline.project_uuid === projectUuid
        ),
        "uuid"
      ),
    [allPipelines, projectUuid]
  );

  return {
    pipelines,
    /** Whether there are any pipelines for the project. */
    isEmpty: pipelines ? Object.keys(pipelines).length === 0 : true,
    ...state,
  };
};
