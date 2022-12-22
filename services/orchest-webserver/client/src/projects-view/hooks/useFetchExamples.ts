import { useExamplesApi } from "@/api/examples/useExamplesApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useFetchExamples = () => {
  const examples = useExamplesApi((api) => api.examples);
  const fetchAll = useExamplesApi((api) => api.fetchAll);
  const { run, error, status } = useAsync<void>();

  React.useEffect(() => {
    if (status !== "IDLE") return;

    run(fetchAll());
  }, [status, fetchAll, run]);

  return { examples, status, error };
};
