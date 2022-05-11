import { ServiceTemplate } from "@/pipeline-settings-view/ServiceTemplatesDialog/content";
import type { Json, PipelineJson, PipelineSettings, Service } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";

export const getOrderValue = () => {
  const lsKey = "_monotonic_getOrderValue";
  // returns monotinically increasing digit
  if (!window.localStorage.getItem(lsKey)) {
    window.localStorage.setItem(lsKey, "0");
  }
  let value = parseInt(window.localStorage.getItem(lsKey) || "null") + 1;
  window.localStorage.setItem(lsKey, value + "");
  return value;
};

export const instantiateNewService = (
  allNames: Set<string>,
  service: ServiceTemplate["config"]
) => {
  let clonedService = cloneDeep(service);

  let count = 0;
  // assuming that user won't have more than 100 instances of the same service
  while (count < 100) {
    const newName = `${clonedService.name}${count === 0 ? "" : count}`;
    if (!allNames.has(newName)) {
      clonedService.name = newName;
      break;
    }
    count += 1;
  }
  return clonedService;
};

export function parseJsonString<T = Json>(str: string | undefined) {
  if (!hasValue(str)) return undefined;
  try {
    const json = JSON.parse(str);
    return json as Record<string, T>;
  } catch (err) {
    return undefined;
  }
}

export const cleanPipelineJson = (pipelineJson: PipelineJson): PipelineJson => {
  let pipelineCopy = cloneDeep(pipelineJson);
  for (let uuid in pipelineCopy.services) {
    const serviceName = pipelineCopy.services[uuid].name;
    delete pipelineCopy.services[uuid].order;
    pipelineCopy.services[serviceName] = {
      ...pipelineCopy.services[uuid],
    };
    delete pipelineCopy.services[uuid];
  }
  return pipelineCopy;
};

export const generatePipelineJsonForSaving = ({
  pipelineJson,
  inputParameters,
  pipelineName,
  services,
  settings = {},
}: {
  pipelineJson: PipelineJson;
  inputParameters: string | undefined;
  pipelineName: string | undefined;
  services: Record<string, Service> | undefined;
  settings: PipelineSettings | undefined;
}): PipelineJson => {
  const parameters = parseJsonString<Json>(inputParameters);

  // Remove order property from services
  return cleanPipelineJson({
    ...pipelineJson,
    name: pipelineName || "",
    parameters: parameters || pipelineJson.parameters,
    services,
    settings,
  });
};
