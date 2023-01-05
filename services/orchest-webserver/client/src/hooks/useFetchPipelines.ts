import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { useHydrate } from "./useHydrate";

export function useFetchPipelines() {
  const pipelines = usePipelinesApi((api) => api.pipelines);
  const state = useHydrate(usePipelinesApi((api) => api.fetchAll));

  return { pipelines, ...state };
}
