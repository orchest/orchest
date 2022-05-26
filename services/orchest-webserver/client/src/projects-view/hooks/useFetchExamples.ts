import { useFetcher } from "@/hooks/useFetcher";
import { Example } from "@/types";

const useFetchExamples = (shouldFetch = true) => {
  const { data, status, error } = useFetcher<
    { creation_time: string; entries: Example[] },
    Example[]
  >(shouldFetch ? "/async/orchest-examples" : undefined, {
    transform: (data) => data.entries,
  });

  return { data, status, error };
};

export { useFetchExamples };
