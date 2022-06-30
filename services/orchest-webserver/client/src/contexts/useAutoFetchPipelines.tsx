import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { withinProjectRoutes } from "@/routingConfig";
import React from "react";
import { useProjectsContext } from "./ProjectsContext";

export const useAutoFetchPipelines = () => {
  const { state, dispatch } = useProjectsContext();
  const { projectUuid: projectUuidFromRoute } = useCustomRoute();

  const matchWithinProjectRoutes = useMatchRoutePaths(withinProjectRoutes);

  const { pipelines, status } = useFetchPipelines(
    projectUuidFromRoute === state.projectUuid && matchWithinProjectRoutes
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
