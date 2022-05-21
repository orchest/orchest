import { Environment } from "@/types";
import { useFetcher } from "./useFetcher";

export function useFetchEnvironments(
  projectUuid: string | undefined,
  queryString = ""
) {
  const { fetchData, data, setData, error, status } = useFetcher<Environment[]>(
    projectUuid ? `/store/environments/${projectUuid}${queryString}` : undefined
  );

  return {
    environments: data,
    error,
    isFetchingEnvironments: status === "PENDING",
    fetchEnvironments: fetchData,
    setEnvironments: setData,
  };
}
