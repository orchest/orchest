import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
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

  const { pipelines, status } = useFetchPipelines(
    projectUuidFromRoute === state.projectUuid && shouldFetch
      ? projectUuidFromRoute
      : undefined
  );

  React.useEffect(() => {
    if (status === "RESOLVED" && pipelines) {
      dispatch({ type: "LOAD_PIPELINES", payload: pipelines });
    }
  }, [status, pipelines, dispatch]);

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
