import { useProjectsContext } from "@/contexts/ProjectsContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLocalStorage } from "./useLocalStorage";

export const useLastSeenPipeline = () => {
  const {
    state: { pipelines, projectUuid, projects, hasLoadedProjects },
  } = useProjectsContext();

  const [lastSeenPipelines, setlastSeenPipelines] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipeline", {});

  const currentProjectUuids = React.useMemo(() => {
    return new Set(projects.map((project) => project.uuid));
  }, [projects]);

  React.useEffect(() => {
    if (hasLoadedProjects) {
      setlastSeenPipelines((current) => {
        if (!current) return {};

        return Object.entries(current).reduce(
          (all, [persistedProjectUuid, persistedPipelineUuid]) => {
            return currentProjectUuids.has(persistedProjectUuid)
              ? { ...all, [persistedProjectUuid]: persistedPipelineUuid }
              : all;
          },
          {} as Record<string, string>
        );
      });
    }
  }, [hasLoadedProjects, projects, setlastSeenPipelines, currentProjectUuids]);

  const lastSeenPipelineUuid = React.useMemo<string | undefined>(() => {
    if (!projectUuid || !lastSeenPipelines) return undefined;

    const pipelineUuidToLoad = lastSeenPipelines[projectUuid];

    if (!hasValue(pipelines) || !hasValue(pipelineUuidToLoad)) return undefined;

    const lastSeenPipeline = pipelines.find(
      (pipeline) => pipeline.uuid === pipelineUuidToLoad
    );
    return lastSeenPipeline?.uuid;
  }, [projectUuid, pipelines, lastSeenPipelines]);

  return [lastSeenPipelineUuid, setlastSeenPipelines] as const;
};
