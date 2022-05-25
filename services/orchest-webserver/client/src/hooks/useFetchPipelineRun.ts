import { PipelineRun } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import { useFetcher } from "./useFetcher";

type FetchPipelineRunProps = {
  jobUuid: string | undefined;
  runUuid: string | undefined;
};

export const fetchPipelineRun = (
  jobUuid: string | undefined,
  runUuid: string | undefined
) =>
  jobUuid && runUuid
    ? fetcher<PipelineRun>(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`)
    : undefined;

export const useFetchPipelineRun = ({
  jobUuid,
  runUuid,
}: FetchPipelineRunProps) => {
  const { data, error, status, fetchData } = useFetcher<PipelineRun>(
    jobUuid && runUuid
      ? `/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`
      : undefined
  );

  return {
    pipelineRun: data,
    error,
    isFetchingPipelineRun: status === "PENDING",
    fetchPipelineRun: fetchData,
    setPipelineRun: fetchData,
  };
};
