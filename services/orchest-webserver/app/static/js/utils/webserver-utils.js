import { makeRequest } from "../lib/utils/all";
import EnvironmentsView from "../views/EnvironmentsView";

export function checkGate(project_uuid) {
  return new Promise((resolve, reject) => {
    // we validate whether all environments have been built on the server
    makeRequest("POST", `/catch/api-proxy/api/validations/environments`, {
      type: "json",
      content: {
        project_uuid: project_uuid,
      },
    })
      .then((response) => {
        try {
          let json = JSON.parse(response);
          if (json.validation === "pass") {
            resolve();
          } else {
            reject({ reason: "gate-failed", data: json });
          }
        } catch (error) {
          console.error(error);
        }
      })
      .catch((error) => {
        reject({ reason: "request-failed", error: error });
      });
  });
}

export function requestBuild(
  project_uuid,
  environmentValidationData,
  requestedFromView
) {
  // NOTE: It is assumed requestBuild is only called after a pipeline gate check
  // fails

  return new Promise((resolve, reject) => {
    let environmentsToBeBuilt = [];

    for (let x = 0; x < environmentValidationData.actions.length; x++) {
      if (environmentValidationData.actions[x] == "BUILD") {
        environmentsToBeBuilt.push(environmentValidationData.fail[x]);
      }
    }

    if (environmentsToBeBuilt.length > 0) {
      orchest.confirm(
        "Build",
        `Not all environments of this project have been built. Would you like to build them?` +
          (requestedFromView == "Pipeline"
            ? " You can cancel to open the pipeline in read-only mode."
            : ""),
        () => {
          let environment_build_requests = [];

          for (let environmentUUID of environmentsToBeBuilt) {
            environment_build_requests.push({
              environment_uuid: environmentUUID,
              project_uuid: project_uuid,
            });
          }

          makeRequest("POST", "/catch/api-proxy/api/environment-builds", {
            type: "json",
            content: {
              environment_build_requests: environment_build_requests,
            },
          })
            .then((_) => {})
            .catch((error) => {
              console.log(error);
            });

          // show environments view
          orchest.loadView(EnvironmentsView, { project_uuid: project_uuid });
          reject();
        },
        () => {
          reject();
        }
      );
    } else {
      orchest.confirm(
        "Build",
        `Some environments of this project are still building. Would you like to check their status?` +
          (requestedFromView == "Pipeline"
            ? " You can cancel to open the pipeline in read-only mode."
            : ""),
        () => {
          // show environments view
          orchest.loadView(EnvironmentsView, { project_uuid: project_uuid });
          reject();
        },
        () => {
          reject();
        }
      );
    }
  });
}

export class BackgroundTaskPoller {
  constructor() {
    this.END_STATUSES = ["SUCCESS", "FAILURE"];
    this.POLL_FREQUENCY = 3000;

    this.taskCallbacks = {};
    this.activeTasks = {};
  }

  startPollingBackgroundTask(taskUUID, onComplete) {
    // default to no-op callback
    if (!onComplete) {
      onComplete = () => {};
    }

    this.activeTasks[taskUUID] = true;
    this.taskCallbacks[taskUUID] = onComplete;
    this.executeDelayedRequest(taskUUID);
  }

  executeDelayedRequest(taskUUID) {
    setTimeout(() => {
      if (this.activeTasks[taskUUID]) {
        this.requestStatus(taskUUID);
      }
    }, this.POLL_FREQUENCY);
  }

  removeTask(taskUUID) {
    delete this.activeTasks[taskUUID];
  }

  removeAllTasks() {
    this.activeTasks = {};
  }

  requestStatus(taskUUID) {
    makeRequest("GET", `/async/background-tasks/${taskUUID}`).then(
      (response) => {
        try {
          let data = JSON.parse(response);
          if (this.END_STATUSES.indexOf(data.status) !== -1) {
            this.taskCallbacks[taskUUID](data);
            this.removeTask(taskUUID);
          } else {
            this.executeDelayedRequest(taskUUID);
          }
        } catch (error) {
          console.error(error);
        }
      }
    );
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

export function formatServerDateTime(dateTimeString) {
  return new Date(
    dateTimeString.replace(/T/, " ").replace(/\..+/, "") + " GMT"
  ).toLocaleString();
}

export function getPipelineJSONEndpoint(
  pipeline_uuid,
  project_uuid,
  job_uuid,
  pipeline_run_uuid
) {
  let pipelineURL = `/async/pipelines/json/${project_uuid}/${pipeline_uuid}`;

  if (job_uuid !== undefined) {
    pipelineURL += `?job_uuid=${job_uuid}`;
  }

  if (pipeline_run_uuid !== undefined) {
    pipelineURL += `&pipeline_run_uuid=${pipeline_run_uuid}`;
  }
  return pipelineURL;
}

export function getPipelineStepParents(stepUUID, pipelineJSON) {
  let incomingConnections = [];
  for (let [_, step] of Object.entries(pipelineJSON.steps)) {
    if (step.uuid == stepUUID) {
      incomingConnections = step.incoming_connections;
      break;
    }
  }

  let parentSteps = [];
  for (let parentStepUUID of incomingConnections) {
    parentSteps.push(pipelineJSON.steps[parentStepUUID]);
  }

  return parentSteps;
}

export function getPipelineStepChildren(stepUUID, pipelineJSON) {
  let childSteps = [];

  for (let [_, step] of Object.entries(pipelineJSON.steps)) {
    if (step.incoming_connections.indexOf(stepUUID) !== -1) {
      childSteps.push(step);
    }
  }

  return childSteps;
}

export function setWithRetry(value, setter, getter, retries, delay, interval) {
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

// Will return undefined if the envVariables are ill defined.
export function envVariablesArrayToDict(envVariables) {
  const result = {};
  const seen = new Set();
  for (const pair of envVariables) {
    if (!pair) {
      continue;
    } else if (!pair["name"] || !pair["value"]) {
      orchest.alert(
        "Error",
        "Environment variables must have a name and value."
      );
      return undefined;
    } else if (seen.has(pair["name"])) {
      orchest.alert(
        "Error",
        "You have defined environment variables with the same name."
      );
      return undefined;
    } else {
      result[pair["name"]] = pair["value"];
      seen.add(pair["name"]);
    }
  }
  return result;
}
