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
  clearCacheOnUnmount?: boolean;
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

  if (!url) return;

  return fetcher<{
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
};

export const useFetchPipelineJson = (
  props: FetchPipelineJsonProps | undefined
) => {
  const { cache } = useSWRConfig();
  const { pipelineUuid, projectUuid, jobUuid, runUuid, clearCacheOnUnmount } =
    props || {};

  const cacheKey = getPipelineJSONEndpoint({
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
  });

  const { data, error, isValidating, mutate } = useSWR<
    PipelineJson | undefined
  >(cacheKey || null, () =>
    fetchPipelineJson({
      pipelineUuid,
      projectUuid,
      jobUuid,
      runUuid,
    })
  );

  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | undefined
        | Promise<PipelineJson | undefined>
        | MutatorCallback<PipelineJson | undefined>
    ) => mutate(data, false),
    [mutate]
  );

  React.useEffect(() => {
    return () => {
      if (clearCacheOnUnmount) {
        setPipelineJson(undefined);
      }
    };
  }, [clearCacheOnUnmount, setPipelineJson]);

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
