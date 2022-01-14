import { getOrderValue } from "@/pipeline-settings-view/common";
import { PipelineJson } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
};

export const useFetchPipelineJson = (props: FetchPipelineJsonProps | null) => {
  const { pipelineUuid, projectUuid, jobUuid, runUuid } = props || {};
  const { data, error, isValidating, revalidate, mutate } = useSWR<
    PipelineJson
  >(
    getPipelineJSONEndpoint(pipelineUuid, projectUuid, jobUuid, runUuid) ||
      null,
    (url: string) =>
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
      })
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

  return {
    pipelineJson: data,
    error,
    isFetchingPipelineJson: isValidating,
    fetchPipelineJson: revalidate,
    setPipelineJson,
  };
};
