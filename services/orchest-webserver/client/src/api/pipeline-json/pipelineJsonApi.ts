import { PipelineJson, PipelineJsonState } from "@/types";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { setOutgoingConnections } from "@/utils/webserver-utils";
import { fetcher, hasValue } from "@orchest/lib-utils";

const BASE_URL = `/async/pipelines/json/`;

export type FetchPipelineJsonParams = {
  projectUuid: string;
  pipelineUuid: string;
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
};

type PipelineJsonResponse = {
  pipeline_json: string;
  success: boolean;
};

const fetchOne = ({
  projectUuid,
  pipelineUuid,
  runUuid: pipelineRunUuid,
  ...queryParams
}: FetchPipelineJsonParams) =>
  fetcher<PipelineJsonResponse>(
    join(BASE_URL, projectUuid, pipelineUuid) +
      "?" +
      queryArgs({ ...queryParams, pipelineRunUuid })
  ).then((response) =>
    createPipelineJsonState(JSON.parse(response.pipeline_json))
  );

const DEFAULT_SETTINGS: Partial<PipelineJson["settings"]> = {
  auto_eviction: false,
  data_passing_memory_size: "1GB",
};

const DEFAULT_VALUES: Partial<PipelineJson> = {
  parameters: {},
  services: {},
};

export const createPipelineJsonState = (
  json: PipelineJson
): PipelineJsonState => {
  const { services = {}, steps = {}, ...data } = {
    ...DEFAULT_VALUES,
    ...prune(json),
    settings: { ...DEFAULT_SETTINGS, ...prune(json.settings) },
  };

  // Previously `order` was managed via localstorage, meaning that `order` could be incorrect.
  // Currently, `order` has become mandatory, which should be guaranteed by BE.
  // To prevent user provides a JSON file with services with wrong order value,
  // we keep the precautions here, and ensure that FE uses and saves the right data.
  const sortedServices = Object.entries(services).sort((a, b) => {
    if (!hasValue(a[1].order) && !hasValue(b[1].order))
      return a[1].name.localeCompare(b[1].name); // If both services have no order value, sort them by name.
    if (!hasValue(a[1].order)) return -1; // move all undefined item to the tail.
    if (!hasValue(b[1].order)) return 1;
    return a[1].order - b[1].order;
  });

  // Ensure that order value is unique, and assign a valid value to `order` if it's undefined
  let maxOrder = -1;
  for (let sorted of sortedServices) {
    const targetServiceOrder = services[sorted[0]].order;
    if (hasValue(targetServiceOrder)) {
      const orderValue =
        maxOrder === targetServiceOrder // Order value is duplicated.
          ? targetServiceOrder + 1
          : targetServiceOrder;
      services[sorted[0]].order = orderValue;
      maxOrder = orderValue;
      continue;
    }

    services[sorted[0]].order = maxOrder + 1;
    maxOrder += 1;
  }

  return {
    ...data,
    services,
    steps: setOutgoingConnections(steps),
  } as PipelineJsonState;
};

export const pipelineJsonApi = { fetchOne };
