import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetcher } from "@/hooks/useFetcher";
import { Example } from "@/types";
import React from "react";

const useFetchExamples = (shouldFetch = true) => {
  const { dispatch } = useProjectsContext();
  const { data, status, error } = useFetcher<
    { creation_time: string; entries: Example[] },
    Example[]
  >(shouldFetch ? "/async/orchest-examples" : undefined, {
    transform: (data) => data.entries,
  });

  React.useEffect(() => {
    if (status === "RESOLVED" && data) {
      dispatch({ type: "SET_EXAMPLES", payload: data });
    }
  }, [data, status]);

  return { data, status, error };
};

export { useFetchExamples };
