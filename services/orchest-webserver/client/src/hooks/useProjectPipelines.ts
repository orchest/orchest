import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import React from "react";

export const useProjectPipelines = (projectUuid: string | undefined) => {
  const pipelines = usePipelinesApi((api) => api.pipelines);

  return React.useMemo(() => {
    return projectUuid
      ? pipelines?.filter(({ project_uuid }) => project_uuid === projectUuid)
      : [];
  }, [pipelines, projectUuid]);
};
