import { getOrderValue } from "@/pipeline-settings-view/common";
import { PipelineJson } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { useSWRConfig } from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
};

export const fetchPipelineJson = (url: string) =>
  fetcher<{
    pipeline_json: string;
    success: boolean;
  }>(url).then((result) => {
    if (!result.success) {
      throw new Error("Failed to fetch pipeline.json");
    }

    const pipelineObj = JSON.parse(result.pipeline_json) as PipelineJson;

    // as settings are optional, populate defaults if no values exist
    if (pipelineObj.settings === undefined) {
      pipelineObj.settings = {};
    }
    if (pipelineObj.settings.auto_eviction === undefined) {
      pipelineObj.settings.auto_eviction = false;
    }
    if (pipelineObj.settings.data_passing_memory_size === undefined) {
      pipelineObj.settings.data_passing_memory_size = "1GB";
    }
    if (pipelineObj.parameters === undefined) {
      pipelineObj.parameters = {};
    }
    if (pipelineObj.services === undefined) {
      pipelineObj.services = {};
    }

    // Augment services with order key
    for (let service in pipelineObj.services) {
      pipelineObj.services[service].order = getOrderValue();
    }

    return pipelineObj;
  });

export const useFetchPipelineJson = (props: FetchPipelineJsonProps | null) => {
  const { cache } = useSWRConfig();
  const { pipelineUuid, projectUuid, jobUuid, runUuid } = props || {};

  const cacheKey = getPipelineJSONEndpoint(
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid
  );

  const { data, error, isValidating, mutate } = useSWR<PipelineJson>(
    cacheKey || null,
    (url: string) => fetchPipelineJson(url)
  );

  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | Promise<PipelineJson>
        | MutatorCallback<PipelineJson>
    ) => mutate(data, false),
    [mutate]
  );

  // Note that pipelineJson should be assumed
  // to be immutable (due to SWR).
  const pipelineJson = data || (cache.get(cacheKey) as PipelineJson);

  return {
    pipelineJson,
    error,
    isFetchingPipelineJson: isValidating,
    fetchPipelineJson: mutate,
    setPipelineJson,
  };
};
