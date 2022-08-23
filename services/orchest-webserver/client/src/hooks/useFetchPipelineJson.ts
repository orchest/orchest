import { transformResponse } from "@/api/pipelines/pipelineJsonApi";
import { PipelineJson } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { useFetcher } from "./useFetcher";

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
};

type PipelineJsonResponse = {
  pipeline_json: string;
  success: boolean;
};

// TODO: replace this with zustand implementation
export const useFetchPipelineJson = (
  props: FetchPipelineJsonProps | undefined
) => {
  const {
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
    revalidateOnFocus = true,
  } = props || {};

  const url = getPipelineJSONEndpoint({
    pipelineUuid,
    projectUuid,
    jobUuid,
    jobRunUuid: runUuid,
  });

  const { data, setData, fetchData, status, error } = useFetcher<
    PipelineJsonResponse,
    PipelineJson
  >(url, {
    transform: transformResponse,
    revalidateOnFocus,
  });

  return {
    pipelineJson: data,
    error,
    isFetchingPipelineJson: status === "PENDING",
    fetchPipelineJson: fetchData,
    setPipelineJson: setData,
  };
};
