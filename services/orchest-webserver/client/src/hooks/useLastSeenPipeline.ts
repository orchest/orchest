import { useProjectsContext } from "@/contexts/ProjectsContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLocalStorage } from "./useLocalStorage";

export const useLastSeenPipeline = () => {
  const {
    state: { pipelines, projectUuid },
  } = useProjectsContext();

  const [lastSeenPipelineString, setlastSeenPipelineString] = useLocalStorage(
    "pipelineEditor.lastSeenPipeline",
    ":"
  );

  const [lastSeenProjectUuid, lastSeenPipelineUuid] = React.useMemo(() => {
    return lastSeenPipelineString.split(":") as [string, string];
  }, [lastSeenPipelineString]);

  const foundLastSeenPipeline = React.useMemo(() => {
    const pipelineUuidToLoad =
      lastSeenProjectUuid === projectUuid ? lastSeenPipelineUuid : undefined;

    if (!hasValue(pipelines) || !hasValue(pipelineUuidToLoad)) return undefined;
    return pipelines.find((pipeline) => pipeline.uuid === pipelineUuidToLoad);
  }, [lastSeenProjectUuid, projectUuid, lastSeenPipelineUuid, pipelines]);

  return [foundLastSeenPipeline, setlastSeenPipelineString] as const;
};
