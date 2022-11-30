import { createPipelineState } from "@/api/pipeline-json/pipelineJsonApi";
import { PipelineState } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { useFetcher } from "./useFetcher";
import { useFetchSnapshot } from "./useFetchSnapshot";

type PipelineJsonResponse = {
  pipeline_json: string;
  success: boolean;
};

export const fetchPipelineJson = (
  props:
    | string
    | {
        pipelineUuid: string | undefined;
        projectUuid: string | undefined;
        jobUuid?: string | undefined;
        runUuid?: string | undefined;
      }
) => {
  const url =
    typeof props === "string" ? props : getPipelineJSONEndpoint(props);

  if (!url) return Promise.reject();

  return fetcher<{
    pipeline_json: string;
    success: boolean;
  }>(url).then((response) =>
    createPipelineState(JSON.parse(response.pipeline_json))
  );
};

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  snapshotUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
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
    snapshotUuid,
    revalidateOnFocus = true,
  } = props || {};

  const isSnapshot = hasValue(snapshotUuid);

  const pipelineJsonUrl = !isSnapshot
    ? getPipelineJSONEndpoint({
        pipelineUuid,
        projectUuid,
        jobUuid,
        jobRunUuid: runUuid,
      })
    : undefined;

  const { data, setData, fetchData, status, error } = useFetcher<
    PipelineJsonResponse,
    PipelineState
  >(pipelineJsonUrl, {
    transform: (response) =>
      createPipelineState(JSON.parse(response.pipeline_json)),
    revalidateOnFocus,
  });

  const { fetchSnapshot, snapshot } = useFetchSnapshot();

  React.useEffect(() => {
    if (pipelineUuid && snapshotUuid) fetchSnapshot(snapshotUuid);
  }, [snapshotUuid, pipelineUuid, fetchSnapshot]);

  const pipelineJsonInSnapshot = React.useMemo(() => {
    if (snapshot?.project_uuid !== projectUuid || !pipelineUuid) return;
    const json = snapshot?.pipelines[pipelineUuid]?.definition;
    return json ? createPipelineState(json) : undefined;
  }, [snapshot, pipelineUuid, projectUuid]);

  return {
    pipelineJson: snapshotUuid ? pipelineJsonInSnapshot : data,
    error,
    isFetchingPipelineJson: status === "PENDING",
    fetchPipelineJson: fetchData,
    setPipelineJson: setData,
  };
};
