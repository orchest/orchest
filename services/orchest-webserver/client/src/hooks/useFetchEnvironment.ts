import { useAsync } from "@/hooks/useAsync";
import { Environment } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

export const useFetchEnvironment = (
  props:
    | { projectUuid: string | undefined; environmentUuid: string | undefined }
    | undefined
) => {
  const { run, data, setData, error, status } = useAsync<Environment>();

  const { projectUuid, environmentUuid } = props || {};

  const sendRequest = React.useCallback(() => {
    if (!projectUuid || !environmentUuid) return;
    const url = `/store/environments/${projectUuid}/${environmentUuid}`;
    return run(fetcher(url));
  }, [run, projectUuid, environmentUuid]);

  React.useEffect(() => {
    sendRequest();
  }, [sendRequest]);

  return {
    environment: data,
    isFetchingEnvironment: status === "PENDING",
    error,
    fetchEnvironment: sendRequest,
    setEnvironment: setData,
  };
};
