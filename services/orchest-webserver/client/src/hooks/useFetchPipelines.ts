import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { useHydrate } from "./useHydrate";

export function useFetchPipelines() {
  const pipelines = usePipelinesApi((api) => api.pipelines);
  const fetchAll = usePipelinesApi((api) => api.fetchAll);
  const state = useHydrate(fetchAll);

  return { pipelines, ...state };
}
