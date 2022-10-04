import type { PipelineMetaData } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import { useFetcher, UseFetcherParams } from "./useFetcher";

export const fetchPipelines = (projectUuid: string) =>
  fetcher<{ result: PipelineMetaData[] }>(
    `/async/pipelines/${projectUuid}`
  ).then((response) => response.result);

export const useFetchPipelines = (
  projectUuid: string | undefined,
  params?: Omit<
    UseFetcherParams<
      { success: boolean; result: PipelineMetaData[] },
      PipelineMetaData[]
    >,
    "transform"
  >
) => {
  const { revalidateOnFocus = true, ...rest } = params || {};

  const { data, error, status, fetchData, setData } = useFetcher<
    { success: boolean; result: PipelineMetaData[] },
    PipelineMetaData[]
  >(projectUuid ? `/async/pipelines/${projectUuid}` : undefined, {
    revalidateOnFocus,
    ...rest,
    transform: (response) => response.result,
  });

  return {
    pipelines: data,
    error,
    isFetchingPipelines: status === "PENDING",
    fetchPipelines: fetchData,
    setPipelines: setData,
    status,
  };
};
