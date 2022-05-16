import { useProjectsContext } from "@/contexts/ProjectsContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLocalStorage } from "./useLocalStorage";

export const useLastSeenPipeline = () => {
  const {
    state: { pipelines, projectUuid },
  } = useProjectsContext();

  const [lastSeenPipelines, setlastSeenPipelines] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipeline", {});

  const lastSeenPipelineUuid = React.useMemo<string | undefined>(() => {
    if (!projectUuid || !lastSeenPipelines) return undefined;

    const pipelineUuidToLoad = lastSeenPipelines[projectUuid];

    if (!hasValue(pipelines) || !hasValue(pipelineUuidToLoad)) return undefined;

    const lastSeenPipeline = pipelines.find(
      (pipeline) => pipeline.uuid === pipelineUuidToLoad
    );
    return lastSeenPipeline?.uuid;
  }, [
    JSON.stringify(lastSeenPipelines),
    projectUuid,
    pipelines,
    // lastSeenPipelines,
  ]);

  return [lastSeenPipelineUuid, setlastSeenPipelines] as const;
};
