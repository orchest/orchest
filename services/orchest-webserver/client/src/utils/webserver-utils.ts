import { EnvVarPair } from "@/components/EnvVarList";
import {
  EnvironmentValidationData,
  Json,
  PipelineJson,
  Service,
  StepData,
  UnidirectionalStepNode,
} from "@/types";
import { pipelineSchema } from "@/utils/pipeline-schema";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import Ajv from "ajv";
import dashify from "dashify";
import { format, parseISO } from "date-fns";
import cloneDeep from "lodash.clonedeep";
import pascalcase from "pascalcase";
import { hasExtension } from "./path";
import { omit } from "./record";

const ajv = new Ajv({
  allowUnionTypes: true,
});

const pipelineValidator = ajv.compile(pipelineSchema);

export function isValidEnvironmentVariableName(name: string) {
  return /^[0-9a-zA-Z\-_]+$/gm.test(name);
}

export function validatePipeline(pipelineJson: PipelineJson) {
  let errors: string[] = [];

  let valid = pipelineValidator(pipelineJson);
  if (!valid) {
    errors.concat(
      (pipelineValidator.errors || []).map(
        (error) => error.message || "Unknown error"
      )
    );
  }

  // Check for non schema validation
  if (pipelineJson.services) {
    for (let serviceName of Object.keys(pipelineJson.services)) {
      if (pipelineJson.services[serviceName].name.length == 0) {
        errors.push("Service name field can't be empty.");
      }
      if (pipelineJson.services[serviceName].name.indexOf(" ") >= 0) {
        errors.push("Service name can't contain spaces.");
      }

      // NOTE: this is enforced at the backend level as well, needs to
      // be kept in sync. More info on the regex can be found there.
      let serviceNameRegex = /^[a-z][0-9a-z\d-]{0,25}$/;
      if (!serviceNameRegex.test(pipelineJson.services[serviceName].name)) {
        errors.push(
          "Service name is invalid. Only lowercase letters, digits and dashes are allowed."
        );
      }
      if (pipelineJson.services[serviceName].image.length == 0) {
        errors.push(
          "Service image field can't be empty. Please check service: " +
            serviceName +
            "."
        );
      }
      if (pipelineJson.services[serviceName].scope.length == 0) {
        errors.push(
          "Services require at least one scope to be enabled. Please check service: " +
            serviceName +
            "."
        );
      }
      if (pipelineJson.services[serviceName].ports.length == 0) {
        errors.push(
          "Services require at least one port to be defined. Please check service: " +
            serviceName +
            "."
        );
      }
    }
  }

  // check whether steps share notebook steps
  outerLoop: for (let stepKey in pipelineJson.steps) {
    let step = pipelineJson.steps[stepKey];

    if (hasExtension(step.file_path, "ipynb")) {
      for (let otherStepKey in pipelineJson.steps) {
        let otherStep = pipelineJson.steps[otherStepKey];

        if (step.uuid === otherStep.uuid) {
          continue;
        }

        if (otherStep.file_path === step.file_path) {
          errors.push(
            `Pipeline step "${step.title}" (${step.uuid}) has the same Notebook assigned as pipeline step "${otherStep.title}" (${otherStep.uuid}).` +
              `Assigning the same Notebook file to multiple steps is not supported.` +
              `Please convert them to scripts in order to reuse the code, e.g. .sh, .py,.R, or .jl.`
          );

          // found an error, stop checking
          break outerLoop;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function filterServices(
  services: Record<string, Partial<Service>>,
  scope: "noninteractive" | "interactive"
) {
  let servicesCopy = cloneDeep(services);
  for (let serviceName in services) {
    if (
      hasValue(servicesCopy[serviceName]?.scope) &&
      !servicesCopy[serviceName]?.scope?.includes(scope)
    ) {
      delete servicesCopy[serviceName];
    }
  }
  return servicesCopy;
}

/**
 * Returns a shallow copy of the steps which includes `outgoing_connections` alongside
 * the `incoming_connections` for each step.
 */
export function setOutgoingConnections<N extends UnidirectionalStepNode>(
  steps: Record<string, N>
): Record<string, N & { outgoing_connections: string[] }> {
  const newSteps = Object.fromEntries(
    Object.entries(steps).map(([uuid, step]) => [
      uuid,
      { ...step, outgoing_connections: [] as string[] },
    ])
  );

  Object.entries(newSteps).forEach(([uuid, step]) => {
    step.incoming_connections.forEach((incomingUuid) => {
      const outgoing = newSteps[incomingUuid].outgoing_connections;

      if (!outgoing.includes(uuid)) {
        newSteps[incomingUuid].outgoing_connections = [...outgoing, uuid];
      }
    });
  });

  return newSteps;
}

export function clearOutgoingConnections<S extends UnidirectionalStepNode>(
  steps: Record<string, S>
): Record<string, Omit<S, "outgoing_connections">> {
  return Object.fromEntries(
    Object.entries(steps).map(([uuid, step]) => [
      uuid,
      { ...omit(step, "outgoing_connections") },
    ])
  );
}

export function getServiceURLs(
  service: Partial<Service>,
  projectUuid: string,
  pipelineUuid: string,
  runUuid: string | undefined
): string[] {
  if (service.ports === undefined) {
    return [];
  }

  let pbpPrefix = "";
  if (service.preserve_base_path) {
    pbpPrefix = "pbp-";
  }

  let sessionUuid = runUuid;
  if (!sessionUuid) {
    sessionUuid = projectUuid.slice(0, 18) + pipelineUuid.slice(0, 18);
  }

  return service.ports.map(
    (port) =>
      window.location.origin +
      "/" +
      pbpPrefix +
      "service-" +
      service.name +
      "-" +
      sessionUuid +
      "_" +
      port +
      "/"
  );
}

// Ensure that environments in the project are ALL built.
export function checkGate(project_uuid: string) {
  return new Promise<void>((resolve, reject) => {
    // we validate whether all environments have been built on the server
    fetcher<EnvironmentValidationData>(
      `/catch/api-proxy/api/validations/environments`,
      {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({ project_uuid }),
      }
    ).then((response) => {
      if (response.validation === "pass") {
        resolve();
      } else {
        reject({
          reason: "gate-failed",
          data: response as EnvironmentValidationData,
        });
      }
    });
  });
}

export const pipelinePathToJsonLocation = (
  pipelinePath: string | undefined
) => {
  if (!pipelinePath || !pipelinePath.endsWith(".orchest")) {
    return;
  }
  return pipelinePath.slice(0, -".orchest".length) + ".parameters.json";
};

export function getScrollLineHeight() {
  const el = document.createElement("div");
  el.style.fontSize = "initial";
  el.style.display = "none";
  document.body.appendChild(el);
  const fontSize = window.getComputedStyle(el).fontSize;
  document.body.removeChild(el);
  return fontSize ? window.parseInt(fontSize) : undefined;
}

export function formatServerDateTime(
  serverDateTimeString: string | null | undefined
) {
  const serverTimeAsDate = hasValue(serverDateTimeString)
    ? serverTimeToDate(serverDateTimeString)
    : undefined;

  // Keep this pattern and the one used in fuzzy DB search in sync, see
  // fuzzy_filter_non_interactive_pipeline_runs.
  return hasValue(serverTimeAsDate)
    ? format(serverTimeAsDate, "LLL d',' yyyy p")
    : "";
}

export function serverTimeToDate(serverDateTimeString: string | undefined) {
  if (!serverDateTimeString) return undefined;
  serverDateTimeString = cleanServerDateTime(serverDateTimeString);
  return parseISO(serverDateTimeString + "Z");
}

export function cleanServerDateTime(dateTimeString) {
  const regex = /^([^\.+]+)([\.+]\d*)?(\+\d*:\d*)?$/m;
  const subst = `$1`;
  return dateTimeString.replace(regex, subst);
}

export function getPipelineJSONEndpoint({
  pipelineUuid,
  jobUuid,
  projectUuid,
  jobRunUuid,
}: {
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  jobUuid?: string | undefined;
  jobRunUuid?: string | undefined;
}) {
  if (!pipelineUuid || !projectUuid) return "";
  let pipelineURL = `/async/pipelines/json/${projectUuid}/${pipelineUuid}`;

  const queryArgs = { job_uuid: jobUuid, pipeline_run_uuid: jobRunUuid };
  // NOTE: pipeline_run_uuid only makes sense if job_uuid is given
  // i.e. a job run requires both uuid's
  const queryString = jobUuid
    ? Object.entries(queryArgs)
        .map(([key, value]) => {
          if (!value) return null;
          return `${key}=${value}`;
        })
        .filter((value) => hasValue(value))
        .join("&")
    : "";

  return queryString ? `${pipelineURL}?${queryString}` : pipelineURL;
}

export function getPipelineStepParents(
  stepUUID: string,
  data: PipelineJson
): StepData[] {
  const step = Object.values(data.steps).find((step) => step.uuid === stepUUID);

  if (!step) return [];

  return step.incoming_connections.map(
    (parentStepUUID) => data.steps[parentStepUUID]
  );
}

const generateParameterLists = (parameters: Record<string, Json>) => {
  let parameterLists = {};

  for (const paramKey in parameters) {
    // Note: the list of parameters for each key will always be
    // a string in the 'strategyJSON' data structure. This
    // facilitates preserving user added indendation.

    // Validity of the user string as JSON is checked client
    // side (for now).
    parameterLists[paramKey] = JSON.stringify([parameters[paramKey]]);
  }

  return parameterLists;
};

export const generateStrategyJson = (
  pipeline: PipelineJson,
  reservedKey = ""
) => {
  const strategyJSON = {};

  if (pipeline.parameters && Object.keys(pipeline.parameters).length > 0) {
    strategyJSON[reservedKey] = {
      key: reservedKey,
      parameters: generateParameterLists(pipeline.parameters),
      title: pipeline.name,
    };
  }

  for (const stepUUID in pipeline.steps) {
    let stepStrategy = JSON.parse(JSON.stringify(pipeline.steps[stepUUID]));

    if (
      stepStrategy.parameters &&
      Object.keys(stepStrategy.parameters).length > 0
    ) {
      // selectively persist only required fields for use in parameter
      // related React components
      strategyJSON[stepUUID] = {
        key: stepUUID,
        parameters: generateParameterLists(stepStrategy.parameters),
        title: stepStrategy.title,
      };
    }
  }

  return strategyJSON;
};

export function getPipelineStepChildren(
  stepUUID: string,
  pipelineState: PipelineJson
): StepData[] {
  return Object.values(pipelineState.steps).filter((step) =>
    step.incoming_connections.includes(stepUUID)
  );
}

export function setWithRetry<T>(
  value: T,
  setter: (value: T) => void,
  getter: () => T,
  retries: number,
  delay: number
): number | undefined {
  if (retries == 0) {
    console.warn("Failed to set with retry for setter (timeout):", setter);
    return;
  }
  try {
    setter(value);
  } catch (error) {
    console.warn("Setter produced an error.", setter, error);
  }
  try {
    if (value === getter()) {
      return;
    }
  } catch (error) {
    console.warn("Getter produced an error.", getter, error);
  }

  return window.setTimeout(() => {
    retries -= 1;
    setWithRetry(value, setter, getter, retries, delay);
  }, delay);
}

export function tryUntilTrue(
  action: () => boolean,
  retries: number,
  delay: number
) {
  let hasWorked = false;

  setWithRetry(
    true,
    () => {
      hasWorked = action();
    },
    () => hasWorked,
    retries,
    delay
  );
}

// Will return undefined if the envVariables are ill defined.
export function envVariablesArrayToDict(
  envVariables: EnvVarPair[] = []
):
  | { status: "resolved"; value: Record<string, string> }
  | { status: "rejected"; error: string } {
  const result = {} as Record<string, string>;
  const seen = new Set();
  for (const pair of envVariables) {
    if (!pair) {
      continue;
    } else if (!pair["name"] || !pair["value"]) {
      return {
        status: "rejected",
        error: "Environment variables must have a name and value.",
      };
    } else if (seen.has(pair["name"])) {
      return {
        status: "rejected",
        error: "You have defined environment variables with the same name.",
      };
    } else {
      result[pair["name"]] = pair["value"];
      seen.add(pair["name"]);
    }
  }
  return { status: "resolved", value: result };
}

// Sorted by key.
export function envVariablesDictToArray(
  envVariables: Record<string, string>
): EnvVarPair[] {
  return Object.keys(envVariables)
    .map((name) => {
      return { name, value: envVariables[name] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/*
 Set of functions related to application routing.
*/

export function URIPathComponentToViewName(pathComponent) {
  // pathComponent:
  // e.g. /some-url/abd/?abc=12 --> just 'some-url' or 'abd'
  return pascalcase(pathComponent) + "View";
}

export function viewNameToURIPathComponent(viewName) {
  // strip 'View' at the end
  viewName = viewName.slice(0, viewName.length - 4);
  return dashify(viewName);
}

export function pascalCaseToCapitalized(viewName) {
  const regex = /([A-Z])/gm;
  const subst = ` $1`;
  return viewName.replace(regex, subst).trim();
}

export function isNumber(value: unknown): value is number {
  return typeof value !== "boolean" && !isNaN(Number(value));
}

export const withPlural = (
  value: number,
  unit: string,
  toPlural = (singular: string) => `${singular}s`
) => `${value} ${value > 1 ? toPlural(unit) : unit}`;
