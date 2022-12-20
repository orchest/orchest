import { useExamplesApi } from "@/api/examples/useExamplesApi";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

/** Fetches (or re-fetches) all examples on mount. */
export const useFetchExamples = () => {
  const examples = useExamplesApi((api) => api.examples);
  const fetchAll = useExamplesApi((api) => api.fetchAll);
  const { run, error, status } = useAsync<void>();

  React.useEffect(() => {
    if (status !== "IDLE") return;

    run(fetchAll());
  }, [status, fetchAll, run]);

  return {
    examples: examples || [],
    hasData: hasValue(examples),
    isFetching: status === "PENDING",
    error,
  };
};
