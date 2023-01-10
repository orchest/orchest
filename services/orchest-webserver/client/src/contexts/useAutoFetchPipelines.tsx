import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjectPipelines } from "@/hooks/useFetchProjectPipelines";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { withinProjectRoutes } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useProjectsContext } from "./ProjectsContext";

export const useAutoFetchPipelinesBase = (
  projectUuidFromRoute: string | undefined,
  shouldFetch: boolean
) => {
  const { state, dispatch } = useProjectsContext();
  const { pipelines, isLoaded } = useFetchProjectPipelines(
    projectUuidFromRoute === state.projectUuid && shouldFetch
      ? projectUuidFromRoute
      : undefined
  );

  React.useEffect(() => {
    if (pipelines && isLoaded) {
      dispatch({ type: "LOAD_PIPELINES", payload: Object.values(pipelines) });
    }
  }, [pipelines, dispatch, isLoaded]);

  return pipelines;
};

export const useAutoFetchPipelines = () => {
  const { projectUuid: projectUuidFromRoute } = useCustomRoute();
  const matchWithinProjectRoutes = useMatchRoutePaths(withinProjectRoutes);

  const pipelines = useAutoFetchPipelinesBase(
    projectUuidFromRoute,
    hasValue(matchWithinProjectRoutes)
  );

  return pipelines;
};
