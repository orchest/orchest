import { Code } from "@/components/common/Code";
import { IconButton } from "@/components/common/IconButton";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ServiceForm from "@/components/ServiceForm";
import { ServiceTemplatesDialog } from "@/components/ServiceTemplatesDialog";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/Routes";
import type { PipelineJson, TViewPropsWithRequiredQueryArgs } from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  getPipelineJSONEndpoint,
  isValidEnvironmentVariableName,
  OverflowListener,
  validatePipeline,
} from "@/utils/webserver-utils";
import DeleteIcon from "@mui/icons-material/Delete";
import ListIcon from "@mui/icons-material/List";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import LinearProgress from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import {
  Alert,
  AlertDescription,
  AlertHeader,
  Box,
  IconLightBulbOutline,
  Link,
} from "@orchest/design-system";
import {
  MDCButtonReact,
  MDCCheckboxReact,
  MDCDataTableReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import _ from "lodash";
import React, { useRef, useState } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 0),
}));

export type IPipelineSettingsView = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const tabMapping: Record<string, number> = {
  configuration: 0,
  "environment-variables": 1,
  services: 2,
};

const tabs = [
  {
    id: "configuration-tab",
    label: "Configuration",
    icon: <ListIcon />,
  },
  {
    id: "environment-variables-tab",
    label: "Environment variables",
    icon: <ViewComfyIcon />,
  },
  {
    id: "services-tab",
    label: "Services",
    icon: <MiscellaneousServicesIcon />,
  },
];

const PipelineSettingsView: React.FC = () => {
  // global states
  const projectsContext = useProjectsContext();
  const {
    state: { hasUnsavedChanges },
    setAlert,
    setConfirm,
    setAsSaved,
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.pipelineSettings.path });

  const sessionsContext = useSessionsContext();
  const { getSession } = sessionsContext;
  useSessionsPoller();

  // data from route
  const {
    navigateTo,
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    initialTab,
    isReadOnly,
  } = useCustomRoute();

  // local states
  const [tabIndex, setTabIndex] = useState<number>(
    tabMapping[initialTab] || 0 // note that initialTab can be 'null' since it's a querystring
  );

  const [state, setState] = React.useState({
    inputParameters: JSON.stringify({}, null, 2),
    restartingMemoryServer: false,
    pipeline_path: undefined,
    dataPassingMemorySize: "1GB",
    pipelineJson: undefined,
    envVariables: [],
    projectEnvVariables: [],
    servicesChanged: false,
    environmentVariablesChanged: false,
  });

  const session = getSession({
    pipelineUuid,
    projectUuid,
  });
  if (
    !session &&
    !hasUnsavedChanges &&
    (state.servicesChanged || state.environmentVariablesChanged)
  ) {
    setState((prevState) => ({
      ...prevState,
      servicesChanged: false,
      environmentVariablesChanged: false,
    }));
  }

  const [overflowListener] = React.useState(new OverflowListener());
  const promiseManagerRef = useRef(new PromiseManager<string>());
  const [refManager] = React.useState(new RefManager());

  const fetchPipelineData = () => {
    fetchPipeline();
    fetchPipelineMetadata();
  };

  const hasLoaded = () => {
    return (
      state.pipelineJson &&
      state.envVariables &&
      (isReadOnly || state.projectEnvVariables)
    );
  };

  // Fetch pipeline data on initial mount
  React.useEffect(() => {
    fetchPipelineData();
    return () => promiseManagerRef.current.cancelCancelablePromises();
  }, []);

  // If the component has loaded, attach the resize listener
  React.useEffect(() => {
    if (hasLoaded()) {
      attachResizeListener();
    }
  }, [state]);

  const setHeaderComponent = (pipelineName: string) =>
    projectsContext.dispatch({
      type: "pipelineSet",
      payload: {
        pipelineUuid,
        projectUuid,
        pipelineName,
      },
    });

  const getOrderValue = () => {
    const lsKey = "_monotonic_getOrderValue";
    // returns monotinically increasing digit
    if (!window.localStorage.getItem(lsKey)) {
      window.localStorage.setItem(lsKey, "0");
    }
    let value = parseInt(window.localStorage.getItem(lsKey)) + 1;
    window.localStorage.setItem(lsKey, value + "");
    return value;
  };

  const addServiceFromTemplate = (service) => {
    let clonedService = _.cloneDeep(service);

    // Take care of service name collisions
    let x = 1;
    let baseServiceName = clonedService.name;
    while (x < 100) {
      if (state.pipelineJson.services[clonedService.name] == undefined) {
        break;
      }
      clonedService.name = baseServiceName + x;
      x++;
    }

    onChangeService(clonedService);
  };

  const onChangeService = (service) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    pipelineJson.services[service.name] = service;

    // Maintain client side order key
    if (service.order === undefined) {
      service.order = getOrderValue();
    }

    setState((prevState) => ({
      ...prevState,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));

    setAsSaved(false);
  };

  const nameChangeService = (oldName, newName) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    let service = pipelineJson.services[oldName];
    service.name = newName;
    pipelineJson.services[newName] = service;
    delete pipelineJson.services[oldName];

    setState((prevState) => ({
      ...prevState,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));

    setAsSaved(false);
  };

  const deleteService = (serviceName) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    delete pipelineJson.services[serviceName];

    setState((prevState) => ({
      ...prevState,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));
    setAsSaved(false);
  };

  const attachResizeListener = () => overflowListener.attach();

  const onSelectTab = (
    e: React.SyntheticEvent<Element, Event>,
    index: number
  ) => {
    setTabIndex(index);
  };

  const fetchPipeline = () => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      pipelineUuid,
      projectUuid,
      jobUuid,
      runUuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManagerRef.current
    );

    pipelinePromise.promise
      .then((response: string) => {
        let result: {
          pipeline_json: string;
          success: boolean;
        } = JSON.parse(response);

        if (result.success) {
          let pipelineJson: PipelineJson = JSON.parse(result["pipeline_json"]);

          // as settings are optional, populate defaults if no values exist
          if (pipelineJson.settings === undefined) {
            pipelineJson.settings = {};
          }
          if (pipelineJson.settings.auto_eviction === undefined) {
            pipelineJson.settings.auto_eviction = false;
          }
          if (pipelineJson.settings.data_passing_memory_size === undefined) {
            pipelineJson.settings.data_passing_memory_size =
              state.dataPassingMemorySize;
          }
          if (pipelineJson.parameters === undefined) {
            pipelineJson.parameters = {};
          }
          if (pipelineJson.services === undefined) {
            pipelineJson.services = {};
          }

          // Augment services with order key
          for (let service in pipelineJson.services) {
            pipelineJson.services[service].order = getOrderValue();
          }

          setHeaderComponent(pipelineJson?.name);
          setState((prevState) => ({
            ...prevState,
            inputParameters: JSON.stringify(pipelineJson?.parameters, null, 2),
            pipelineJson: pipelineJson,
            dataPassingMemorySize:
              pipelineJson?.settings.data_passing_memory_size,
          }));
        } else {
          console.warn("Could not load pipeline.json");
          console.log(result);
        }
      })
      .catch((err) => console.log(err));
  };

  const fetchPipelineMetadata = () => {
    if (!jobUuid) {
      // get pipeline path
      let cancelableRequest = makeCancelable<string>(
        makeRequest(
          "GET",
          `/async/pipelines/${projectUuid}/${pipelineUuid}`
        ) as Promise<string>,
        promiseManagerRef.current
      );

      cancelableRequest.promise.then((response: string) => {
        let pipeline = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          pipeline_path: pipeline.path,
          envVariables: envVariablesDictToArray(pipeline["env_variables"]),
        }));
      });

      // get project environment variables
      let cancelableProjectRequest = makeCancelable<string>(
        makeRequest("GET", `/async/projects/${projectUuid}`) as Promise<string>,
        promiseManagerRef.current
      );

      cancelableProjectRequest.promise
        .then((response) => {
          let project = JSON.parse(response);

          setState((prevState) => ({
            ...prevState,
            projectEnvVariables: envVariablesDictToArray(
              project["env_variables"]
            ),
          }));
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      let cancelableJobPromise = makeCancelable<string>(
        makeRequest("GET", `/catch/api-proxy/api/jobs/${jobUuid}`) as Promise<
          string
        >,
        promiseManagerRef.current
      );
      let cancelableRunPromise = makeCancelable<string>(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`
        ) as Promise<string>,
        promiseManagerRef.current
      );

      Promise.all([
        cancelableJobPromise.promise.then((response) => {
          let job = JSON.parse(response);
          return job.pipeline_run_spec.run_config.pipeline_path;
        }),

        cancelableRunPromise.promise.then((response) => {
          let run = JSON.parse(response);
          return envVariablesDictToArray(run["env_variables"]);
        }),
      ])
        .then((values) => {
          let [pipeline_path, envVariables] = values;
          setState((prevState) => ({
            ...prevState,
            pipeline_path,
            envVariables,
          }));
        })
        .catch((err) => console.log(err));
    }
  };

  const closeSettings = () => {
    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
      },
      state: { isReadOnly },
    });
  };

  const onChangeName = (value: string) => {
    setState((prevState) => ({
      ...prevState,
      pipelineJson: {
        ...prevState.pipelineJson,
        name: value,
      },
    }));
    setAsSaved(false);
  };

  const onChangePipelineParameters = (editor, data, value) => {
    setState((prevState) => ({
      ...prevState,
      inputParameters: value,
    }));

    try {
      const parametersJSON = JSON.parse(value);

      setState((prevState) => ({
        ...prevState,
        pipelineJson: {
          ...prevState?.pipelineJson,
          parameters: parametersJSON,
        },
      }));

      setAsSaved(false);
    } catch (err) {
      // console.log("JSON did not parse")
    }
  };

  const isValidMemorySize = (value) =>
    value.match(/^(\d+(\.\d+)?\s*(KB|MB|GB))$/);

  const onChangeDataPassingMemorySize = (value) => {
    setState((prevState) => ({
      ...prevState,
      dataPassingMemorySize: value,
    }));

    if (isValidMemorySize(value)) {
      setState((prevState) => ({
        ...prevState,
        pipelineJson: {
          ...prevState.pipelineJson,
          settings: {
            ...prevState.pipelineJson?.settings,
            data_passing_memory_size: value,
          },
        },
      }));
      setAsSaved(false);
    }
  };

  const onChangeEviction = (value) => {
    // create settings object if it doesn't exist
    if (!state.pipelineJson?.settings) {
      setState((prevState) => ({
        ...prevState,
        pipelineJson: {
          ...prevState.pipelineJson,
          settings: {},
        },
      }));
    }

    setState((prevState) => ({
      ...prevState,
      pipelineJson: {
        ...prevState.pipelineJson,
        settings: {
          ...prevState.pipelineJson?.settings,
          auto_eviction: value,
        },
      },
    }));
    setAsSaved(false);
  };

  const addEnvVariablePair = (e) => {
    e.preventDefault();

    setState((prevState) => {
      const envVariables = prevState.envVariables.slice();

      return {
        ...prevState,
        envVariables: envVariables.concat([
          {
            name: null,
            value: null,
          },
        ]),
      };
    });
  };

  const onEnvVariablesChange = (value, idx, type) => {
    setState((prevState) => {
      const envVariables = prevState.envVariables.slice();
      envVariables[idx][type] = value;

      return { ...prevState, envVariables, environmentVariablesChanged: true };
    });
    setAsSaved(false);
  };

  const onEnvVariablesDeletion = (idx) => {
    setState((prevState) => {
      const envVariables = prevState.envVariables.slice();
      envVariables.splice(idx, 1);

      return { ...prevState, envVariables };
    });
    setAsSaved(false);
  };

  const cleanPipelineJson = (pipelineJson) => {
    let pipelineCopy = _.cloneDeep(pipelineJson);
    for (let serviceName in pipelineCopy.services) {
      delete pipelineCopy.services[serviceName].order;
    }
    return pipelineCopy;
  };

  const validateServiceEnvironmentVariables = (pipeline: any) => {
    for (let serviceName in pipeline.services) {
      let service = pipeline.services[serviceName];

      if (service.env_variables === undefined) {
        continue;
      }

      for (let envVariableName of Object.keys(service.env_variables)) {
        if (!isValidEnvironmentVariableName(envVariableName)) {
          setAlert(
            "Error",
            `Invalid environment variable name: "${envVariableName}" in service "${service.name}".`
          );
          return false;
        }
      }
    }
    return true;
  };

  const saveGeneralForm = (e: MouseEvent) => {
    e.preventDefault();

    // Remove order property from services
    let pipelineJson = cleanPipelineJson(state.pipelineJson);

    let validationResult = validatePipeline(pipelineJson);
    if (!validationResult.valid) {
      setAlert("Error", validationResult.errors[0]);
      return;
    }

    // Validate environment variables of services
    if (!validateServiceEnvironmentVariables(pipelineJson)) {
      return;
    }

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables.status === "rejected") {
      setAlert("Error", envVariables.error);
      setTabIndex(1);
      return;
    }

    // Validate pipeline level environment variables
    for (let envVariableName of Object.keys(envVariables.value)) {
      if (!isValidEnvironmentVariableName(envVariableName)) {
        setAlert(
          "Error",
          `Invalid environment variable name: "${envVariableName}".`
        );
        setTabIndex(1);
        return;
      }
    }

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(pipelineJson));

    makeRequest(
      "POST",
      `/async/pipelines/json/${projectUuid}/${pipelineUuid}`,
      {
        type: "FormData",
        content: formData,
      }
    )
      .then((response: string) => {
        let result = JSON.parse(response);
        if (result.success) {
          setState((prevState) => ({
            ...prevState,
          }));
          setAsSaved();

          // Sync name changes with the global context
          projectsContext.dispatch({
            type: "pipelineSet",
            payload: {
              pipelineName: pipelineJson?.name,
            },
          });
        }
      })
      .catch((response) => {
        console.error("Could not save: pipeline definition OR Notebook JSON");
        console.error(response);
      });

    makeRequest("PUT", `/async/pipelines/${projectUuid}/${pipelineUuid}`, {
      type: "json",
      content: { env_variables: envVariables.value },
    }).catch((response) => {
      console.error(response);
    });
  };

  const restartMemoryServer = () => {
    if (!state.restartingMemoryServer) {
      setState((prevState) => ({
        ...prevState,
        restartingMemoryServer: true,
      }));

      // perform POST to save
      let restartPromise = makeCancelable(
        makeRequest(
          "PUT",
          `/catch/api-proxy/api/sessions/${projectUuid}/${pipelineUuid}`
        ),
        promiseManagerRef.current
      );

      restartPromise.promise
        .then(() => {
          setState((prevState) => ({
            ...prevState,
            restartingMemoryServer: false,
          }));
        })
        .catch((response) => {
          if (!response.isCanceled) {
            let errorMessage =
              "Could not clear memory server, reason unknown. Please try again later.";
            try {
              errorMessage = JSON.parse(response.body)["message"];
              if (errorMessage == "SessionNotRunning") {
                errorMessage =
                  "Session is not running, please try again later.";
              }
            } catch (error) {
              console.error(error);
            }

            setAlert("Error", errorMessage);

            setState((prevState) => ({
              ...prevState,
              restartingMemoryServer: false,
            }));
          }
        });
    } else {
      console.error(
        "Already busy restarting memory server. UI should prohibit this call."
      );
    }
  };

  return (
    <Layout>
      <div className="view-page pipeline-settings-view">
        {hasLoaded() ? (
          <div className="pipeline-settings">
            <h2>Pipeline settings</h2>

            <Tabs
              value={tabIndex}
              onChange={onSelectTab}
              label="View pipeline settings"
              data-test-id="pipeline-settings"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  id={tab.id}
                  label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
                  aria-controls={tab.id}
                />
              ))}
            </Tabs>

            <div className="tab-view trigger-overflow">
              <CustomTabPanel value={tabIndex} index={0} name="configuration">
                <div className="configuration">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div className="columns">
                      <div className="column">
                        <h3>Name</h3>
                      </div>
                      <div className="column">
                        <MDCTextFieldReact
                          value={state.pipelineJson?.name}
                          onChange={onChangeName}
                          label="Pipeline name"
                          disabled={isReadOnly}
                          classNames={["push-down"]}
                          data-test-id="pipeline-settings-configuration-pipeline-name"
                        />
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Path</h3>
                      </div>
                      <div className="column">
                        {state.pipeline_path && (
                          <p className="push-down">
                            <Code>{state.pipeline_path}</Code>
                          </p>
                        )}
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Pipeline parameters</h3>
                      </div>
                      <div className="column">
                        <CodeMirror
                          value={state.inputParameters}
                          options={{
                            mode: "application/json",
                            theme: "jupyter",
                            lineNumbers: true,
                            readOnly: isReadOnly,
                          }}
                          onBeforeChange={onChangePipelineParameters}
                        />
                        {(() => {
                          try {
                            JSON.parse(state.inputParameters);
                          } catch {
                            return (
                              <div className="warning push-up push-down">
                                <i className="material-icons">warning</i> Your
                                input is not valid JSON.
                              </div>
                            );
                          }
                        })()}
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Data passing</h3>
                      </div>
                      <div className="column">
                        {!isReadOnly && (
                          <p className="push-up">
                            <i>
                              For these changes to take effect you have to
                              restart the memory-server (see button below).
                            </i>
                          </p>
                        )}

                        <div className="checkbox-tooltip-holder">
                          <MDCCheckboxReact
                            value={state.pipelineJson?.settings?.auto_eviction}
                            onChange={onChangeEviction}
                            label="Automatic memory eviction"
                            disabled={isReadOnly}
                            classNames={["push-down", "push-up"]}
                            data-test-id="pipeline-settings-configuration-memory-eviction"
                          />
                          <Tooltip title="Auto eviction makes sure outputted objects are evicted once all depending steps have obtained it as an input.">
                            <i
                              className="material-icons inline-icon push-up"
                              aria-describedby="tooltip-memory-eviction"
                            >
                              info
                            </i>
                          </Tooltip>
                        </div>

                        {!isReadOnly && (
                          <p className="push-down">
                            Change the size of the memory server for data
                            passing. For units use KB, MB, or GB, e.g.{" "}
                            <Code>1GB</Code>.{" "}
                          </p>
                        )}

                        <div>
                          <MDCTextFieldReact
                            value={state.dataPassingMemorySize}
                            onChange={onChangeDataPassingMemorySize}
                            label="Data passing memory size"
                            disabled={isReadOnly}
                            data-test-id="pipeline-settings-configuration-memory-size"
                          />
                        </div>
                        {(() => {
                          if (!isValidMemorySize(state.dataPassingMemorySize)) {
                            return (
                              <div className="warning push-up">
                                <i className="material-icons">warning</i> Not a
                                valid memory size.
                              </div>
                            );
                          }
                        })()}
                      </div>
                      <div className="clear"></div>
                    </div>
                  </form>

                  {!isReadOnly && (
                    <div className="columns">
                      <div className="column">
                        <h3>Actions</h3>
                      </div>
                      <div className="column">
                        <p className="push-down">
                          Restarting the memory-server also clears the memory to
                          allow additional data to be passed between pipeline
                          steps.
                        </p>
                        <div className="push-down">
                          {(() => {
                            if (state.restartingMemoryServer) {
                              return (
                                <p className="push-p push-down">
                                  Restarting in progress...
                                </p>
                              );
                            }
                          })()}

                          <MDCButtonReact
                            disabled={state.restartingMemoryServer}
                            label="Restart memory-server"
                            icon="memory"
                            classNames={["mdc-button--raised push-down"]}
                            onClick={restartMemoryServer}
                            data-test-id="pipeline-settings-configuration-restart-memory-server"
                          />
                        </div>
                      </div>
                      <div className="clear"></div>
                    </div>
                  )}
                </div>
              </CustomTabPanel>
              <CustomTabPanel
                value={tabIndex}
                index={1}
                name="environment-variables"
              >
                {state.environmentVariablesChanged && session && (
                  <div className="warning push-down">
                    <i className="material-icons">warning</i>
                    Note: changes to environment variables require a session
                    restart to take effect.
                  </div>
                )}
                {isReadOnly ? (
                  <EnvVarList
                    value={state.envVariables}
                    readOnly={true}
                    data-test-id="pipeline-read-only"
                  />
                ) : (
                  <>
                    <h3 className="push-down">Project environment variables</h3>
                    <EnvVarList
                      value={state.projectEnvVariables}
                      readOnly={true}
                      data-test-id="project-read-only"
                    />

                    <h3 className="push-down">
                      Pipeline environment variables
                    </h3>
                    <p className="push-down">
                      Pipeline environment variables take precedence over
                      project environment variables.
                    </p>
                    <EnvVarList
                      value={state.envVariables}
                      onAdd={addEnvVariablePair}
                      onChange={(e, idx, type) =>
                        onEnvVariablesChange(e, idx, type)
                      }
                      onDelete={(idx) => onEnvVariablesDeletion(idx)}
                      data-test-id="pipeline"
                    />
                  </>
                )}
              </CustomTabPanel>
              <CustomTabPanel value={tabIndex} index={2} name="services">
                <Box css={{ "> * + *": { marginTop: "$4" } }}>
                  {state.servicesChanged && session && (
                    <div className="warning push-up">
                      <i className="material-icons">warning</i>
                      Note: changes to services require a session restart to
                      take effect.
                    </div>
                  )}
                  <MDCDataTableReact
                    headers={["Service", "Scope", "Delete"]}
                    rows={Object.keys(state.pipelineJson.services)
                      .map(
                        (serviceName) =>
                          state.pipelineJson.services[serviceName]
                      )
                      .sort((a, b) => a.order - b.order)
                      .map((service) => [
                        service.name,
                        service.scope
                          .map((scope) => {
                            const scopeMap = {
                              interactive: "Interactive sessions",
                              noninteractive: "Job sessions",
                            };
                            return scopeMap[scope];
                          })
                          .sort()
                          .join(", "),
                        <div className="consume-click" key={service.name}>
                          <IconButton
                            title="Delete"
                            disabled={isReadOnly}
                            onClick={() => {
                              setConfirm(
                                "Warning",
                                "Are you sure you want to delete the service: " +
                                  service.name +
                                  "?",
                                () => {
                                  deleteService(service.name);
                                }
                              );
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </div>,
                      ])}
                    detailRows={Object.keys(state.pipelineJson.services)
                      .map(
                        (serviceName) =>
                          state.pipelineJson.services[serviceName]
                      )
                      .sort((a, b) => a.order - b.order)
                      .map((service, i) => {
                        return null;
                        return (
                          <ServiceForm
                            key={["ServiceForm", i].join("-")}
                            service={service}
                            disabled={isReadOnly}
                            updateService={onChangeService}
                            nameChangeService={nameChangeService}
                            pipeline_uuid={pipelineUuid}
                            project_uuid={projectUuid}
                            run_uuid={runUuid}
                          />
                        );
                      })}
                    data-test-id="pipeline-services"
                  />
                  <Alert status="info">
                    <AlertHeader>
                      <IconLightBulbOutline />
                      Want to start using Services?
                    </AlertHeader>
                    <AlertDescription>
                      <Link
                        target="_blank"
                        href="https://docs.orchest.io/en/stable/user_guide/services.html"
                        rel="noopener noreferrer"
                      >
                        Learn more
                      </Link>{" "}
                      about how to expand your pipeline’s capabilities.
                    </AlertDescription>
                  </Alert>
                  {!isReadOnly && (
                    <ServiceTemplatesDialog
                      onSelection={(template) =>
                        addServiceFromTemplate(template)
                      }
                    />
                  )}
                </Box>
              </CustomTabPanel>
            </div>
            <div className="top-buttons">
              <MDCButtonReact
                classNames={["close-button"]}
                icon="close"
                onClick={closeSettings}
                data-test-id="pipeline-settings-close"
              />
            </div>
            {!isReadOnly && (
              <div className="bottom-buttons observe-overflow">
                <MDCButtonReact
                  label={hasUnsavedChanges ? "SAVE*" : "SAVE"}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={saveGeneralForm}
                  icon="save"
                  data-test-id="pipeline-settings-save"
                />
              </div>
            )}
          </div>
        ) : (
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default PipelineSettingsView;
