import { PipelineJson } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useFocusBrowserTab } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

type FetchPipelineJsonProps = {
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
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

    // Previously `order` was managed via localstorage, meaning that `order` could be incorrect.
    // Currently, `order` has become mandatory, which should be guaranteed by BE.
    // To prevent user provides a JSON file with services with wrong order value,
    // we keep the precautions here, and ensure that FE uses and saves the right data.

    const sortedServices = Object.entries(pipelineObj.services).sort((a, b) => {
      if (!hasValue(a[1].order) && !hasValue(b[1].order))
        return a[1].name.localeCompare(b[1].name); // If both services have no order value, sort them by name.
      if (!hasValue(a[1].order)) return -1; // move all undefined item to the tail.
      if (!hasValue(b[1].order)) return 1;
      return a[1].order - b[1].order;
    });
    // Ensure that order value is unique, and assign a valid value to `order` if it's undefined
    let maxOrder = -1;
    for (let sorted of sortedServices) {
      const targetServiceOrder = pipelineObj.services[sorted[0]].order;
      if (hasValue(targetServiceOrder)) {
        const orderValue =
          maxOrder === targetServiceOrder // Order value is duplicated.
            ? targetServiceOrder + 1
            : targetServiceOrder;
        pipelineObj.services[sorted[0]].order = orderValue;
        maxOrder = orderValue;
        continue;
      }

      pipelineObj.services[sorted[0]].order = maxOrder + 1;
      maxOrder += 1;
    }

    return pipelineObj;
  });
};

// `useSWR` has a unexpected behavior when cache key costantly changes.
// Sometimes it doesn't refetch, and also doesn't update its data based on the cache key.
// Using our custom `useAsync` could achieve most things except caching, but it gives more stability.

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

  const { run, data, setData, status, error } = useAsync<PipelineJson>();

  const url = getPipelineJSONEndpoint({
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
  });

  const makeRequest = React.useCallback(() => {
    return run(fetchPipelineJson(url));
  }, [run, url]);

  const isFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(isFocused);
  const shouldRefetch =
    revalidateOnFocus && hasBrowserFocusChanged && isFocused;

  const hasFetchedOnMount = React.useRef(false);

  React.useEffect(() => {
    hasFetchedOnMount.current = false;
  }, [url]);

  React.useEffect(() => {
    if (url && (!hasFetchedOnMount.current || shouldRefetch)) {
      hasFetchedOnMount.current = true;
      makeRequest();
    }
  }, [shouldRefetch, makeRequest, url]);

  return {
    pipelineJson: data,
    error,
    isFetchingPipelineJson: status === "PENDING",
    fetchPipelineJson: makeRequest,
    setPipelineJson: setData,
  };
};
