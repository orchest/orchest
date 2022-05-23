import { Environment } from "@/types";
import { useFetcher } from "./useFetcher";

export const useFetchEnvironment = (
  props:
    | { projectUuid: string | undefined; environmentUuid: string | undefined }
    | undefined
) => {
  const { projectUuid, environmentUuid } = props || {};
  const { data, setData, error, status, fetchData } = useFetcher<Environment>(
    projectUuid && environmentUuid
      ? `/store/environments/${projectUuid}/${environmentUuid}`
      : undefined
  );

  return {
    environment: data,
    isFetchingEnvironment: status === "PENDING",
    error,
    fetchEnvironment: fetchData,
    setEnvironment: setData,
  };
};
