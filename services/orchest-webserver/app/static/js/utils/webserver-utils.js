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

export function requestBuild(project_uuid, environmentValidationData) {
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
        `The following environment UUIDs haven't been built: [${environmentsToBeBuilt}]. Would you like to build them?`,
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

          resolve();
        },
        () => {
          reject();
        }
      );
    } else {
      resolve();
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

export function getPipelineJSONEndpoint(
  pipeline_uuid,
  project_uuid,
  experiment_uuid,
  run_uuid
) {
  let pipelineURL = `/async/pipelines/json/${project_uuid}/${pipeline_uuid}`;

  if (experiment_uuid !== undefined) {
    pipelineURL += `?experiment_uuid=${experiment_uuid}`;
  }

  if (run_uuid !== undefined) {
    pipelineURL += `&pipeline_run_uuid=${run_uuid}`;
  }
  return pipelineURL;
}
