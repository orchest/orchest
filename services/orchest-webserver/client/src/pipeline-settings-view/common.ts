import { ServiceTemplate } from "@/components/ServiceTemplatesDialog/content";
import type { PipelineJson, PipelineSettings, Service } from "@/types";
import "codemirror/mode/javascript/javascript";
import cloneDeep from "lodash.clonedeep";

export const getOrderValue = () => {
  const lsKey = "_monotonic_getOrderValue";
  // returns monotinically increasing digit
  if (!window.localStorage.getItem(lsKey)) {
    window.localStorage.setItem(lsKey, "0");
  }
  let value = parseInt(window.localStorage.getItem(lsKey)) + 1;
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

export const parseJsonString = (str: string) => {
  try {
    const json = JSON.parse(str);
    return json;
  } catch (err) {
    return null;
  }
};

export const cleanPipelineJson = (
  pipelineJson: PipelineJson
): Omit<PipelineJson, "order"> => {
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
  settings,
}: {
  pipelineJson: PipelineJson;
  inputParameters: string;
  pipelineName: string;
  services: Record<string, Service>;
  settings: PipelineSettings;
}): PipelineJson => {
  if (!pipelineJson) return null;
  const parameters = parseJsonString(inputParameters);

  // Remove order property from services
  return cleanPipelineJson({
    ...pipelineJson,
    name: pipelineName,
    parameters: parameters || pipelineJson.parameters,
    services,
    settings,
  });
};
