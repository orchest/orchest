import { usePipelineJsonApi } from "@/api/pipeline-json/usePipelineJsonApi";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import React from "react";
import { useAsync } from "./useAsync";

/** Returns all pipeline definitions within the active project. */
export const useProjectPipelineJsons = () => {
  const definitions = usePipelineJsonApi((api) => api.definitions);
  const fetchOne = usePipelineJsonApi((api) => api.fetchOne);
  const { pipelines, projectUuid } = useProjectsContext().state;
  const { run, status } = useAsync();

  React.useEffect(() => {
    if (status !== "IDLE" || !projectUuid) return;

    const promises = pipelines
      ?.filter((pipeline) => !definitions[pipeline.uuid])
      .map((pipeline) =>
        fetchOne({
          projectUuid,
          pipelineUuid: pipeline.uuid,
        })
      );

    if (promises) run(Promise.all(promises));
  }, [pipelines, projectUuid, definitions, fetchOne, status, run]);

  return React.useMemo(
    () =>
      pipelines
        ?.map((pipeline) => definitions[pipeline.uuid])
        .filter(Boolean) ?? [],
    [definitions, pipelines]
  );
};
