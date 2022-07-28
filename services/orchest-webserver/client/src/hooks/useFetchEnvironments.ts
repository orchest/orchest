import { queryArgs } from "@/pipeline-view/file-manager/common";
import { Environment } from "@/types";
import { useFetcher } from "./useFetcher";

export const useFetchEnvironments = (
  projectUuid: string | undefined,
  language?: string
) => {
  const queryString = language ? `?${queryArgs({ language })}` : "";
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
};
