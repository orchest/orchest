import _ from "lodash";
import Ajv from "ajv";

import { makeRequest, extensionFromFilename } from "@orchest/lib-utils";
import { format, parseISO } from "date-fns";
import dashify from "dashify";
import pascalcase from "pascalcase";

import ConfigureJupyterLabView from "../views/ConfigureJupyterLabView";
import EditJobView from "../views/EditJobView";
import EnvironmentEditView from "../views/EnvironmentEditView";
import EnvironmentsView from "../views/EnvironmentsView";
import FileManagerView from "../views/FileManagerView";
import FilePreviewView from "../views/FilePreviewView";
import HelpView from "../views/HelpView";
import JobsView from "../views/JobsView";
import JobView from "../views/JobView";
import JupyterLabView from "../views/JupyterLabView";
import LogsView from "../views/LogsView";
import ManageUsersView from "../views/ManageUsersView";
import PipelineSettingsView from "../views/PipelineSettingsView";
import PipelinesView from "../views/PipelinesView";
import PipelineView from "../views/PipelineView";
import ProjectSettingsView from "../views/ProjectSettingsView";
import ProjectsView from "../views/ProjectsView";
import SettingsView from "../views/SettingsView";
import UpdateView from "../views/UpdateView";
import { pipelineSchema } from "@/utils/pipeline-schema";

const ajv = new Ajv({
  allowUnionTypes: true,
});

const pipelineValidator = ajv.compile(pipelineSchema);

function getComponentObject() {
  // This {str: Class} mapping is required for name
  // resolution after Class name obfuscation performed
  // by the JS minifier.
  return {
    ConfigureJupyterLabView,
    EditJobView,
    EnvironmentEditView,
    EnvironmentsView,
    FileManagerView,
    FilePreviewView,
    HelpView,
    JobsView,
    JobView,
    JupyterLabView,
    LogsView,
    ManageUsersView,
    PipelineSettingsView,
    PipelinesView,
    PipelineView,
    ProjectSettingsView,
    ProjectsView,
    SettingsView,
    UpdateView,
  };
}

export function getViewDrawerParentViewName(viewName) {
  /* This function describes the parent->child relation
     between child views and root views listed
     in the drawer menu.

     This is used for example for selecting the right
     drawer item when a child view is loaded.
  */

  let viewHierarchy = {
    ConfigureJupyterLabView: SettingsView,
    EditJobView: JobsView,
    EnvironmentEditView: EnvironmentsView,
    EnvironmentsView: EnvironmentsView,
    FileManagerView: FileManagerView,
    FilePreviewView: PipelinesView,
    HelpView: HelpView,
    JobsView: JobsView,
    JobView: JobsView,
    JupyterLabView: PipelinesView,
    ManageUsersView: SettingsView,
    PipelineSettingsView: PipelinesView,
    PipelinesView: PipelinesView,
    LogsView: PipelinesView,
    ProjectSettingsView: ProjectsView,
    ProjectsView: ProjectsView,
    SettingsView: SettingsView,
    UpdateView: SettingsView,
  };
  return componentName(viewHierarchy[viewName]);
}

export function nameToComponent(viewName) {
  return getComponentObject()[viewName];
}

export function componentName(TagName) {
  let viewComponents = getComponentObject();
  for (let viewName of Object.keys(viewComponents)) {
    if (viewComponents[viewName] === TagName) {
      return viewName;
    }
  }
  if (process.env.NODE_ENV === "development") {
    console.log("Was not able to get componentName for TagName " + TagName);
  }
}

export function validatePipeline(pipelineJson) {
  let errors = [];

  let valid = pipelineValidator(pipelineJson);
  if (!valid) {
    errors.concat(pipelineValidator.errors);
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
            `Pipeline step "${step.title}" (${step.uuid}) has the same Notebook assigned as pipeline step "${otherStep.title}" (${otherStep.uuid}). Assigning the same Notebook file to multiple steps is not supported. Please convert to a script to re-use file across pipeline steps.`
          );

          // found an error, stop checking
          break outerLoop;
        }
      }
    }
  }

  return { valid: errors.length == 0, errors };
}

export function filterServices(services, scope) {
  let servicesCopy = _.cloneDeep(services);
  for (let serviceName in services) {
    if (servicesCopy[serviceName].scope.indexOf(scope) == -1) {
      delete servicesCopy[serviceName];
    }
  }
  return servicesCopy;
}

export function getServiceURLs(service, project_uuid, pipeline_uuid, run_uuid) {
  let urls = [];

  if (service.ports === undefined) {
    return urls;
  }

  let serviceUUID = pipeline_uuid;
  if (run_uuid !== undefined) {
    serviceUUID = run_uuid;
  }

  let pbpPrefix = "";
  if (service.preserve_base_path) {
    pbpPrefix = "pbp-";
  }

  for (let port of service.ports) {
    urls.push(
      window.location.origin +
        "/" +
        pbpPrefix +
        "service-" +
        service.name +
        "-" +
        project_uuid.split("-")[0] +
        "-" +
        serviceUUID.split("-")[0] +
        "_" +
        port +
        "/"
    );
  }

  return urls;
}

export function createOutgoingConnections(steps) {
  for (let step_uuid in steps) {
    if (steps.hasOwnProperty(step_uuid)) {
      steps[step_uuid].outgoing_connections = [];
    }
  }

  for (let step_uuid in steps) {
    if (steps.hasOwnProperty(step_uuid)) {
      let incoming_connections = steps[step_uuid].incoming_connections;
      for (let x = 0; x < incoming_connections.length; x++) {
        steps[incoming_connections[x]].outgoing_connections.push(step_uuid);
      }
    }
  }

  return steps;
}

export function checkGate(project_uuid) {
  return new Promise((resolve, reject) => {
    // we validate whether all environments have been built on the server
    makeRequest("POST", `/catch/api-proxy/api/validations/environments`, {
      type: "json",
      content: {
        project_uuid: project_uuid,
      },
    })
      .then((response: string) => {
        try {
          let json = JSON.parse(response);
          if (json.validation === "pass") {
            resolve(undefined);
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

export class OverflowListener {
  triggerOverflow: any;

  constructor() {}

  attach() {
    // check if ResizeObserver is defined
    if (window.ResizeObserver) {
      // trigger-overflow only supports a single element on the page
      // @ts-ignore
      let triggerOverflow = $(".trigger-overflow").first()[0];
      if (triggerOverflow && this.triggerOverflow !== triggerOverflow) {
        new ResizeObserver(() => {
          if (triggerOverflow) {
            // @ts-ignore
            if ($(triggerOverflow).overflowing()) {
              // @ts-ignore
              $(".observe-overflow").addClass("overflowing");
            } else {
              // @ts-ignore
              $(".observe-overflow").removeClass("overflowing");
            }
          }
        }).observe(triggerOverflow);
        this.triggerOverflow = triggerOverflow;
      }
    }
  }
}

export class BackgroundTaskPoller {
  END_STATUSES: ["SUCCESS", "FAILURE"];
  POLL_FREQUENCY: number;
  taskCallbacks: any;
  activeTasks: any;

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
      (response: string) => {
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

export function formatServerDateTime(serverDateTimeString) {
  return format(serverTimeToDate(serverDateTimeString), "LLL d',' yyyy p");
}

export function serverTimeToDate(serverDateTimeString) {
  serverDateTimeString = cleanServerDateTime(serverDateTimeString);
  return parseISO(serverDateTimeString + "Z");
}

export function cleanServerDateTime(dateTimeString) {
  const regex = /^([^\.+]+)([\.+]\d*)?(\+\d*:\d*)?$/m;
  const subst = `$1`;
  return dateTimeString.replace(regex, subst);
}

export function getPipelineJSONEndpoint(
  pipeline_uuid,
  project_uuid,
  job_uuid?,
  pipeline_run_uuid?
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
    if ((step as any).uuid == stepUUID) {
      incomingConnections = (step as any).incoming_connections;
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
    if ((step as any).incoming_connections.indexOf(stepUUID) !== -1) {
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
export function envVariablesArrayToDict(envVariables) {
  const { orchest } = window;
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

// Sorted by key.
export function envVariablesDictToArray(envVariables) {
  let result = new Array(Object.keys(envVariables).length).fill(null);
  Object.keys(envVariables).map((name, idx) => {
    result[idx] = { name: name, value: envVariables[name] };
  });
  result.sort((a, b) => a["name"].localeCompare(b["name"]));

  return result;
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

export function generateRoute(TagName, dynamicProps) {
  // returns: [pathname, search]
  let search = queryArgPropsToQueryArgs(
    dynamicProps ? dynamicProps.queryArgs : {}
  );
  let pathname = "/" + viewNameToURIPathComponent(componentName(TagName));
  return [pathname, search];
}

export function decodeRoute(pathname, search) {
  // note: pathname includes '/' prefix
  // note: search includes '?' prefix
  // returns: [TagName, props]
  let TagName = nameToComponent(
    URIPathComponentToViewName(pathname.split("/")[1])
  );

  let queryArgProps = queryArgsToQueryArgProps(search);

  return [TagName, { queryArgs: queryArgProps }];
}

export function queryArgPropsToQueryArgs(queryArgProps) {
  // note: only string based query args are supported
  if (!queryArgProps || Object.keys(queryArgProps).length == 0) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryArgProps)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return "?" + searchParams.toString();
}

export function queryArgsToQueryArgProps(search) {
  // note: only string based query args are supported
  // note: search includes '?' prefix
  let searchParams = new URLSearchParams(search);
  let queryArgProps = {};

  // @ts-ignore
  for (let [key, value] of searchParams.entries()) {
    queryArgProps[key] = value;
  }

  return queryArgProps;
}

export function pascalCaseToCapitalized(viewName) {
  const regex = /([A-Z])/gm;
  const subst = ` $1`;
  return viewName.replace(regex, subst).trim();
}

export function loadIntercom(
  INTERCOM_APP_ID,
  INTERCOM_USER_EMAIL,
  INTERCOM_DEFAULT_SIGNUP_DATE
) {
  var w = window;
  var ic = w.Intercom;
  if (typeof ic === "function") {
    ic("reattach_activator");
    // @ts-ignore
    ic("update", w.intercomSettings);
  } else {
    var d = document;
    var i = function () {
      i.c(arguments);
    } as any;
    i.q = [];
    i.c = function (args) {
      i.q.push(args);
    };
    w.Intercom = i;
    var l = function () {
      var s = d.createElement("script");
      s.type = "text/javascript";
      s.async = true;
      s.src = "https://widget.intercom.io/widget/v61sr629";
      var x = d.getElementsByTagName("script")[0];
      x.parentNode.insertBefore(s, x);
    };

    // if (w.attachEvent) {
    //   w.attachEvent("onload", l);
    // } else {
    //   w.addEventListener("load", l, false);
    // }

    // Modified original embed snippet as window.load
    // has already triggered.
    l();
  }

  // consumed by Intercom's function collector (i)
  window.Intercom("boot", {
    app_id: INTERCOM_APP_ID,
    name: "",
    email: INTERCOM_USER_EMAIL, // Email address
    created_at: INTERCOM_DEFAULT_SIGNUP_DATE, // Signup date as a Unix timestamp
  });
}

/*
 End of routing functions.
*/
