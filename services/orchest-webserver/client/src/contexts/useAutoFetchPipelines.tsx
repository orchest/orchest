import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProjectPipelines } from "@/hooks/useFetchProjectPipelines";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { useOnBrowserTabFocus } from "@/hooks/useOnTabFocus";
import { withinProjectRoutes } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";

export const useAutoFetchPipelinesBase = (
  projectUuidFromRoute: string | undefined,
  shouldFetch: boolean
) => {
  const { pipelines, reload } = useFetchProjectPipelines(
    projectUuidFromRoute && shouldFetch ? projectUuidFromRoute : undefined
  );

  useOnBrowserTabFocus(reload);

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
