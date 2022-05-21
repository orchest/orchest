import { Pipeline } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import { useFetcher } from "./useFetcher";

type FetchPipelineProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
};

export const fetchPipeline = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) =>
  projectUuid && pipelineUuid
    ? fetcher<Pipeline>(`/async/pipelines/${projectUuid}/${pipelineUuid}`)
    : undefined;

export const useFetchPipeline = (props: FetchPipelineProps | undefined) => {
  const { projectUuid, pipelineUuid } = props || {};

  const { data, error, status, fetchData, setData } = useFetcher(
    projectUuid && pipelineUuid
      ? `/async/pipelines/${projectUuid}/${pipelineUuid}`
      : undefined
  );

  return {
    pipeline: data,
    error,
    isFetchingPipeline: status === "PENDING",
    fetchPipeline: fetchData,
    setPipeline: setData,
  };
};
