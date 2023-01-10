import { useExamplesApi } from "@/api/examples/useExamplesApi";
import { useHydrate } from "./useHydrate";

/** Fetches (or re-fetches) all examples on mount. */
export const useFetchExamples = () => {
  const examples = useExamplesApi((api) => api.examples);
  const fetchAll = useExamplesApi((api) => api.fetchAll);
  const state = useHydrate(fetchAll);

  return { examples, ...state };
};
