import { EnvVarPair } from "@/components/EnvVarList";
import {
  EnvironmentValidationData,
  PipelineJson,
  PipelineStepState,
  Service,
  Step,
} from "@/types";
import { pipelineSchema } from "@/utils/pipeline-schema";
import {
  extensionFromFilename,
  fetcher,
  hasValue,
  HEADER,
} from "@orchest/lib-utils";
import Ajv from "ajv";
import dashify from "dashify";
import { format, parseISO } from "date-fns";
import $ from "jquery";
import cloneDeep from "lodash.clonedeep";
import pascalcase from "pascalcase";

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
      // be kept in sync.
      let serviceNameRegex = /^[a-zA-Z\d-]{1,36}$/;
      if (!serviceNameRegex.test(pipelineJson.services[serviceName].name)) {
        errors.push(
          "Service name contains illegal characters. Only use letters, digits and dashes."
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

    if (extensionFromFilename(step.file_path) === "ipynb") {
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
 * Augment incoming_connections with outgoing_connections to be able
 * to traverse from root nodes. Reset outgoing_connections state.
 * Note: this function mutates the original steps object
 * @param steps
 * @returns stepsWithOutgoingConnections
 */
export function addOutgoingConnections<
  T extends Record<
    string,
    Pick<PipelineStepState, "incoming_connections" | "outgoing_connections">
  >
>(steps: T) {
  Object.keys(steps).forEach((stepUuid) => {
    // Every step NEEDs to have an `.outgoing_connections` defined.
    steps[stepUuid].outgoing_connections =
      steps[stepUuid].outgoing_connections || [];

    steps[stepUuid].incoming_connections.forEach((incomingConnectionUuid) => {
      const outgoingConnections = new Set(
        steps[incomingConnectionUuid].outgoing_connections || []
      );
      outgoingConnections.add(stepUuid);
      steps[incomingConnectionUuid].outgoing_connections = [
        ...outgoingConnections,
      ];
    });
  });
  return steps;
}

export function clearOutgoingConnections<
  T,
  K extends Omit<T, "outgoing_connections">
>(steps: T): K {
  return Object.entries(steps).reduce((newObj, [stepUuid, step]) => {
    const { outgoing_connections, ...cleanStep } = step; // eslint-disable-line @typescript-eslint/no-unused-vars

    return { ...newObj, [stepUuid]: cleanStep };
  }, {} as K);
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

export class OverflowListener {
  private observer: ResizeObserver | undefined;
  private triggerOverflow: HTMLElement | undefined;

  constructor() {} // eslint-disable-line @typescript-eslint/no-empty-function

  attach() {
    // check if ResizeObserver is defined
    if (window.ResizeObserver) {
      // trigger-overflow only supports a single element on the page

      let triggerOverflow = $(".trigger-overflow").first()[0];
      if (triggerOverflow && this.triggerOverflow !== triggerOverflow) {
        this.triggerOverflow = triggerOverflow;
        this.observer = new ResizeObserver(() => {
          if (!this.triggerOverflow) return;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if ($(this.triggerOverflow).overflowing()) {
            $(".observe-overflow").addClass("overflowing");
          } else {
            $(".observe-overflow").removeClass("overflowing");
          }
        });
        this.observer.observe(this.triggerOverflow);
      }
    }
  }

  detach() {
    if (this.observer && this.triggerOverflow) {
      this.observer.unobserve(this.triggerOverflow);
    }
  }
}

export type CreateProjectError =
  | "project move failed"
  | "project name contains illegal character";

export type BackgroundTask =
  | {
      uuid: string;
      status: "SUCCESS" | "FAILURE";
      result: CreateProjectError | string;
    }
  | {
      uuid: string;
      status: "PENDING";
      result: null;
    };

export class BackgroundTaskPoller {
  private END_STATUSES: string[];
  private taskCallbacks: Record<string, (task: BackgroundTask) => void>;
  private activeTasks: Record<string, boolean>;

  public POLL_FREQUENCY: number;

  constructor() {
    this.END_STATUSES = ["SUCCESS", "FAILURE"];
    this.POLL_FREQUENCY = 3000;

    this.taskCallbacks = {};
    this.activeTasks = {};
  }

  startPollingBackgroundTask(
    taskUuid: string,
    onComplete: (task: BackgroundTask) => void
  ) {
    // default to no-op callback
    if (!onComplete) {
      onComplete = () => {}; // eslint-disable-line @typescript-eslint/no-empty-function
    }

    this.activeTasks[taskUuid] = true;
    this.taskCallbacks[taskUuid] = onComplete;
    this.executeDelayedRequest(taskUuid);
  }

  executeDelayedRequest(taskUuid: string) {
    setTimeout(() => {
      if (this.activeTasks[taskUuid]) {
        this.requestStatus(taskUuid);
      }
    }, this.POLL_FREQUENCY);
  }

  removeTask(taskUuid: string) {
    delete this.activeTasks[taskUuid];
  }

  removeAllTasks() {
    this.activeTasks = {};
  }

  async requestStatus(taskUuid: string) {
    try {
      const data = await fetcher<BackgroundTask>(
        `/async/background-tasks/${taskUuid}`
      );

      if (this.END_STATUSES.includes(data.status)) {
        this.taskCallbacks[taskUuid](data);
        this.removeTask(taskUuid);
      } else {
        this.executeDelayedRequest(taskUuid);
      }
    } catch (error) {
      console.error(error);
    }
  }
}

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
  runUuid,
}: {
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
}) {
  if (!pipelineUuid || !projectUuid) return "";
  let pipelineURL = `/async/pipelines/json/${projectUuid}/${pipelineUuid}`;

  const queryArgs = { job_uuid: jobUuid, pipeline_run_uuid: runUuid };
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
  pipelineJSON: PipelineJson
) {
  let incomingConnections: string[] = [];
  for (let step of Object.values(pipelineJSON.steps)) {
    if (step.uuid === stepUUID) {
      incomingConnections = step.incoming_connections;
      break;
    }
  }

  return incomingConnections.map(
    (parentStepUUID) => pipelineJSON.steps[parentStepUUID]
  );
}

export function getPipelineStepChildren(
  stepUUID: string,
  pipelineJSON: PipelineJson
) {
  let childSteps: Step[] = [];

  for (let step of Object.values(pipelineJSON.steps)) {
    if (step.incoming_connections.includes(stepUUID)) {
      childSteps.push(step);
    }
  }

  return childSteps;
}

export function setWithRetry(value, setter, getter, retries, delay, interval?) {
  if (retries == 0) {
    console.warn("Failed to set with retry for setter (timeout):", setter);
    clearInterval(interval);
    return;
  }
  try {
    setter(value);
  } catch (error) {
    console.warn("Setter produced an error.", setter, error);
  }
  try {
    if (value == getter()) {
      if (interval) {
        clearInterval(interval);
      }
      return;
    }
  } catch (error) {
    console.warn("Getter produced an error.", getter, error);
  }
  if (interval === undefined) {
    interval = setInterval(() => {
      retries -= 1;
      setWithRetry(value, setter, getter, retries, delay, interval);
    }, delay);

    return interval;
  }
}

export function tryUntilTrue(action, retries, delay, interval?) {
  let hasWorked = false;

  setWithRetry(
    true,
    () => {
      hasWorked = action();
    },
    () => {
      return hasWorked;
    },
    retries,
    delay,
    interval
  );
}

// Will return undefined if the envVariables are ill defined.
export function envVariablesArrayToDict(
  envVariables: EnvVarPair[] = []
):
  | { status: "resolved"; value: Record<string, unknown> }
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
  return !isNaN(Number(value));
}

export const withPlural = (
  value: number,
  unit: string,
  toPlural = (singular: string) => `${singular}s`
) => `${value} ${value > 1 ? toPlural(unit) : unit}`;
