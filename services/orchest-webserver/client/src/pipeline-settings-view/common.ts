import { ServiceTemplate } from "@/pipeline-settings-view/ServiceTemplatesDialog/content";
import type {
  Json,
  PipelineJsonState,
  PipelineSettings,
  Service,
} from "@/types";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";

export const instantiateNewService = (
  allNames: Set<string>,
  service: ServiceTemplate["config"],
  order: number
): Service => {
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
  return { ...clonedService, order };
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

export const cleanPipelineJson = (
  pipelineJson: PipelineJsonState
): PipelineJsonState => {
  let pipelineCopy = cloneDeep(pipelineJson);
  for (let uuid in pipelineCopy.services) {
    const serviceName = pipelineCopy.services[uuid].name;
    pipelineCopy.services[serviceName] = {
      ...pipelineCopy.services[uuid],
    };
    delete pipelineCopy.services[uuid];
  }
  return pipelineCopy;
};

export const generatePipelineJsonForSaving = ({
  pipelineJson,
  pipelineParameters,
  pipelineName,
  services,
  settings = {},
}: {
  pipelineJson: PipelineJsonState;
  pipelineParameters: string | undefined;
  pipelineName: string | undefined;
  services: Record<string, Service> | undefined;
  settings: PipelineSettings | undefined;
}): PipelineJsonState => {
  const parameters = parseJsonString<Json>(pipelineParameters);

  return cleanPipelineJson({
    ...pipelineJson,
    name: pipelineName || "",
    parameters: parameters || pipelineJson.parameters,
    services,
    settings,
  });
};
