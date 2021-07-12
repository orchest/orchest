import * as React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import _ from "lodash";
import "codemirror/mode/javascript/javascript";
import {
  Box,
  Alert,
  AlertHeader,
  AlertDescription,
  IconLightBulbOutline,
  Link,
} from "@orchest/design-system";

import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "@orchest/lib-utils";
import {
  MDCButtonReact,
  MDCTextFieldReact,
  MDCCheckboxReact,
  MDCTabBarReact,
  MDCDataTableReact,
  MDCLinearProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { useOrchest, OrchestSessionsConsumer } from "@/hooks/orchest";
import {
  getPipelineJSONEndpoint,
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
  validatePipeline,
} from "@/utils/webserver-utils";
import { Layout } from "@/components/Layout";
import EnvVarList from "@/components/EnvVarList";
import ServiceForm from "@/components/ServiceForm";
import { ServiceTemplatesDialog } from "@/components/ServiceTemplatesDialog";
import PipelineView from "@/views/PipelineView";

const PipelineSettingsView: React.FC<any> = (props) => {
  const orchest = window.orchest;

  const { dispatch, get } = useOrchest();

  const session = get.session(props.queryArgs);

  const [state, setState] = React.useState({
    selectedTabIndex: 0,
    inputParameters: JSON.stringify({}, null, 2),
    restartingMemoryServer: false,
    unsavedChanges: false,
    pipeline_path: undefined,
    dataPassingMemorySize: "1GB",
    pipelineJson: undefined,
    envVariables: [],
    projectEnvVariables: [],
    servicesChanged: false,
  });

  if (!session && !state.unsavedChanges && state.servicesChanged) {
    setState((prevState) => ({
      ...prevState,
      servicesChanged: false,
    }));
  }

  const [overflowListener] = React.useState(new OverflowListener());
  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const fetchPipelineData = () => {
    fetchPipeline();
    fetchPipelineMetadata();
  };

  const handleInitialTab = () => {
    const tabMapping = {
      configuration: 0,
      "environment-variables": 1,
      services: 2,
    };

    if (props.queryArgs.initial_tab) {
      setState((prevProps) => ({
        ...prevProps,
        selectedTabIndex: tabMapping[props.queryArgs.initial_tab],
      }));
    }
  };

  const hasLoaded = () => {
    return (
      state.pipelineJson &&
      state.envVariables &&
      (props.queryArgs.read_only === "true" || state.projectEnvVariables)
    );
  };

  // Fetch pipeline data on initial mount
  React.useEffect(() => {
    fetchPipelineData();
    handleInitialTab();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  // Fetch pipeline data when query args change
  React.useEffect(() => {
    fetchPipelineData();
  }, [props.queryArgs]);

  // If the component has loaded, attach the resize listener
  React.useEffect(() => {
    if (hasLoaded()) {
      attachResizeListener();
    }
  }, [state]);

  /* sync local unsaved changes with global state */
  React.useEffect(() => {
    dispatch({
      type: "setUnsavedChanges",
      payload: state.unsavedChanges,
    });
  }, [state.unsavedChanges]);

  const setHeaderComponent = (pipelineName) =>
    dispatch({
      type: "pipelineSet",
      payload: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        pipelineName: pipelineName,
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
      unsavedChanges: true,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));
  };

  const nameChangeService = (oldName, newName) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    let service = pipelineJson.services[oldName];
    service.name = newName;
    pipelineJson.services[newName] = service;
    delete pipelineJson.services[oldName];

    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));
  };

  const deleteService = (serviceName) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    delete pipelineJson.services[serviceName];

    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      servicesChanged: true,
      pipelineJson: pipelineJson,
    }));
  };

  const attachResizeListener = () => overflowListener.attach();

  const onSelectSubview = (index) => {
    setState((prevState) => ({
      ...prevState,
      selectedTabIndex: index,
    }));
  };

  const fetchPipeline = () => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      props.queryArgs.pipeline_uuid,
      props.queryArgs.project_uuid,
      props.queryArgs.job_uuid,
      props.queryArgs.run_uuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManager
    );

    // @ts-ignore
    pipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);

      if (result.success) {
        let pipelineJson = JSON.parse(result["pipeline_json"]);

        // as settings are optional, populate defaults if no values exist
        if (pipelineJson?.settings === undefined) {
          pipelineJson.settings = {};
        }
        if (pipelineJson?.settings.auto_eviction === undefined) {
          pipelineJson.settings.auto_eviction = false;
        }
        if (pipelineJson?.settings.data_passing_memory_size === undefined) {
          pipelineJson.settings.data_passing_memory_size =
            state.dataPassingMemorySize;
        }
        if (pipelineJson?.parameters === undefined) {
          pipelineJson.parameters = {};
        }
        if (pipelineJson?.services === undefined) {
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
    });
  };

  const fetchPipelineMetadata = () => {
    if (!props.queryArgs.job_uuid) {
      // get pipeline path
      let cancelableRequest = makeCancelable(
        makeRequest(
          "GET",
          `/async/pipelines/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`
        ),
        promiseManager
      );

      // @ts-ignore
      cancelableRequest.promise.then((response) => {
        let pipeline = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          pipeline_path: pipeline.path,
          envVariables: envVariablesDictToArray(pipeline["env_variables"]),
        }));
      });

      // get project environment variables
      let cancelableProjectRequest = makeCancelable(
        makeRequest("GET", `/async/projects/${props.queryArgs.project_uuid}`),
        promiseManager
      );

      // @ts-ignore
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
      let cancelableJobPromise = makeCancelable(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${props.queryArgs.job_uuid}`
        ),
        promiseManager
      );
      let cancelableRunPromise = makeCancelable(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${props.queryArgs.job_uuid}/${props.queryArgs.run_uuid}`
        ),
        promiseManager
      );

      Promise.all([
        // @ts-ignore
        cancelableJobPromise.promise.then((response) => {
          let job = JSON.parse(response);
          return job.pipeline_run_spec.run_config.pipeline_path;
        }),
        // @ts-ignore
        cancelableRunPromise.promise.then((response) => {
          let run = JSON.parse(response);
          return envVariablesDictToArray(run["env_variables"]);
        }),
      ]).then((values) => {
        let [pipeline_path, envVariables] = values;
        setState((prevState) => ({
          ...prevState,
          pipeline_path: pipeline_path,
          envVariables: envVariables,
        }));
      });
    }
  };

  const closeSettings = () =>
    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        read_only: props.queryArgs.read_only,
        job_uuid: props.queryArgs.job_uuid,
        run_uuid: props.queryArgs.run_uuid,
      },
    });

  const onChangeName = (value) =>
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      pipelineJson: {
        ...prevState.pipelineJson,
        name: value,
      },
    }));

  const onChangePipelineParameters = (editor, data, value) => {
    setState((prevState) => ({
      ...prevState,
      inputParameters: value,
    }));

    try {
      const parametersJSON = JSON.parse(value);

      setState((prevState) => ({
        ...prevState,
        unsavedChanges: true,
        pipelineJson: {
          ...prevState?.pipelineJson,
          parameters: parametersJSON,
        },
      }));
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
        unsavedChanges: true,
        pipelineJson: {
          ...prevState.pipelineJson,
          settings: {
            ...prevState.pipelineJson?.settings,
            data_passing_memory_size: value,
          },
        },
      }));
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
        unsavedChanges: true,
      },
    }));
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

      return { ...prevState, envVariables, unsavedChanges: true };
    });
  };

  const onEnvVariablesDeletion = (idx) => {
    setState((prevState) => {
      const envVariables = prevState.envVariables.slice();
      envVariables.splice(idx, 1);

      return { ...prevState, envVariables, unsavedChanges: true };
    });
  };

  const cleanPipelineJson = (pipelineJson) => {
    let pipelineCopy = _.cloneDeep(pipelineJson);
    for (let serviceName in pipelineCopy.services) {
      delete pipelineCopy.services[serviceName].order;
    }
    return pipelineCopy;
  };

  const saveGeneralForm = (e) => {
    e.preventDefault();

    // Remove order property from services
    let pipelineJson = cleanPipelineJson(state.pipelineJson);

    let validationResult = validatePipeline(pipelineJson);
    if (!validationResult.valid) {
      orchest.alert("Error", validationResult.errors[0]);
      return;
    }

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      onSelectSubview(1);
      return;
    }

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(pipelineJson));

    makeRequest(
      "POST",
      `/async/pipelines/json/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`,
      { type: "FormData", content: formData }
    )
      .then((response: string) => {
        let result = JSON.parse(response);
        if (result.success) {
          setState((prevState) => ({
            ...prevState,
            unsavedChanges: false,
          }));

          // Sync name changes with the global context
          dispatch({
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

    makeRequest(
      "PUT",
      `/async/pipelines/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`,
      {
        type: "json",
        content: { env_variables: envVariables },
      }
    ).catch((response) => {
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
          `/catch/api-proxy/api/sessions/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`
        ),
        promiseManager
      );

      // @ts-ignore
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
            orchest.alert("Error", errorMessage);

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

  const sortService = (serviceA, serviceB) => serviceA.order - serviceB.order;

  return (
    <OrchestSessionsConsumer>
      <Layout>
        <div className="view-page pipeline-settings-view">
          {hasLoaded() ? (
            <div className="pipeline-settings">
              <h2>Pipeline settings</h2>

              <div className="push-down">
                <MDCTabBarReact
                  selectedIndex={state.selectedTabIndex}
                  ref={
                    // @ts-ignore
                    refManager.nrefs.tabBar
                  }
                  items={["Configuration", "Environment variables", "Services"]}
                  icons={["list", "view_comfy", "miscellaneous_services"]}
                  onChange={onSelectSubview.bind(this)}
                />
              </div>

              <div className="tab-view trigger-overflow">
                {
                  {
                    0: (
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
                                onChange={onChangeName.bind(this)}
                                label="Pipeline name"
                                disabled={props.queryArgs.read_only === "true"}
                                classNames={["push-down"]}
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
                                  <span className="code">
                                    {state.pipeline_path}
                                  </span>
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
                                  readOnly:
                                    props.queryArgs.read_only === "true",
                                }}
                                onBeforeChange={onChangePipelineParameters.bind(
                                  this
                                )}
                              />
                              {(() => {
                                try {
                                  JSON.parse(state.inputParameters);
                                } catch {
                                  return (
                                    <div className="warning push-up push-down">
                                      <i className="material-icons">warning</i>{" "}
                                      Your input is not valid JSON.
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
                              {props.queryArgs.read_only !== "true" && (
                                <p className="push-up">
                                  <i>
                                    For these changes to take effect you have to
                                    restart the memory-server (see button
                                    below).
                                  </i>
                                </p>
                              )}

                              <MDCCheckboxReact
                                value={
                                  state.pipelineJson?.settings?.auto_eviction
                                }
                                onChange={onChangeEviction.bind(this)}
                                label="Automatic memory eviction"
                                disabled={props.queryArgs.read_only === "true"}
                                classNames={["push-down", "push-up"]}
                              />

                              {props.queryArgs.read_only !== "true" && (
                                <p className="push-down">
                                  Change the size of the memory server for data
                                  passing. For units use KB, MB, or GB, e.g.{" "}
                                  <span className="code">1GB</span>.{" "}
                                </p>
                              )}

                              <div>
                                <MDCTextFieldReact
                                  value={state.dataPassingMemorySize}
                                  onChange={onChangeDataPassingMemorySize.bind(
                                    this
                                  )}
                                  label="Data passing memory size"
                                  disabled={
                                    props.queryArgs.read_only === "true"
                                  }
                                />
                              </div>
                              {(() => {
                                if (
                                  !isValidMemorySize(
                                    state.dataPassingMemorySize
                                  )
                                ) {
                                  return (
                                    <div className="warning push-up">
                                      <i className="material-icons">warning</i>{" "}
                                      Not a valid memory size.
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                            <div className="clear"></div>
                          </div>
                        </form>

                        {props.queryArgs.read_only !== "true" && (
                          <div className="columns">
                            <div className="column">
                              <h3>Actions</h3>
                            </div>
                            <div className="column">
                              <p className="push-down">
                                Restarting the memory-server also clears the
                                memory to allow additional data to be passed
                                between pipeline steps.
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
                                  onClick={restartMemoryServer.bind(this)}
                                />
                              </div>
                            </div>
                            <div className="clear"></div>
                          </div>
                        )}
                      </div>
                    ),
                    1: (
                      <div>
                        {(() => {
                          if (props.queryArgs.read_only === "true") {
                            return (
                              <>
                                <EnvVarList
                                  value={state.envVariables}
                                  readOnly={true}
                                />
                              </>
                            );
                          } else {
                            return (
                              <>
                                <h3 className="push-down">
                                  Project environment variables
                                </h3>
                                <EnvVarList
                                  value={state.projectEnvVariables}
                                  readOnly={true}
                                />

                                <h3 className="push-down">
                                  Pipeline environment variables
                                </h3>
                                <p className="push-down">
                                  Pipeline environment variables take precedence
                                  over project environment variables.
                                </p>
                                <EnvVarList
                                  value={state.envVariables}
                                  onAdd={addEnvVariablePair.bind(this)}
                                  onChange={(e, idx, type) =>
                                    onEnvVariablesChange(e, idx, type)
                                  }
                                  onDelete={(idx) =>
                                    onEnvVariablesDeletion(idx)
                                  }
                                />
                                <p className="push-up">
                                  <i>
                                    Note: restarting the session is required to
                                    update environment variables in Jupyter
                                    kernels.
                                  </i>
                                </p>
                              </>
                            );
                          }
                        })()}
                      </div>
                    ),
                    2: (
                      <Box css={{ "> * + *": { marginTop: "$4" } }}>
                        {state.servicesChanged && session && (
                          <div className="warning push-up">
                            <i className="material-icons">warning</i>
                            Note: changes to services require a session restart
                            to take effect.
                          </div>
                        )}
                        <MDCDataTableReact
                          headers={["Service", "Scope", "Delete"]}
                          rows={Object.keys(state.pipelineJson.services)
                            .map(
                              (serviceName) =>
                                state.pipelineJson.services[serviceName]
                            )
                            .sort(sortService)
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
                              <div className="consume-click">
                                <MDCIconButtonToggleReact
                                  icon="delete"
                                  disabled={
                                    props.queryArgs.read_only === "true"
                                  }
                                  onClick={() => {
                                    orchest.confirm(
                                      "Warning",
                                      "Are you sure you want to delete the service: " +
                                        service.name +
                                        "?",
                                      () => {
                                        deleteService(service.name);
                                      }
                                    );
                                  }}
                                />
                              </div>,
                            ])}
                          detailRows={Object.keys(state.pipelineJson.services)
                            .map(
                              (serviceName) =>
                                state.pipelineJson.services[serviceName]
                            )
                            .sort(sortService)
                            .map((service, i) => (
                              <ServiceForm
                                key={["ServiceForm", i].join("-")}
                                service={service}
                                disabled={props.queryArgs.read_only === "true"}
                                updateService={onChangeService}
                                nameChangeService={nameChangeService}
                                pipeline_uuid={props.queryArgs.pipeline_uuid}
                                project_uuid={props.queryArgs.project_uuid}
                                run_uuid={props.queryArgs.run_uuid}
                              />
                            ))}
                        />

                        <Alert status="info">
                          <AlertHeader>
                            <IconLightBulbOutline />
                            Want to start using Services?
                          </AlertHeader>
                          <AlertDescription>
                            <Link
                              target="_blank"
                              href="https://orchest.readthedocs.io/en/stable/user_guide/services.html"
                              rel="noopener noreferrer"
                            >
                              Learn more
                            </Link>{" "}
                            about how to expand your pipeline’s capabilities.
                          </AlertDescription>
                        </Alert>

                        {props.queryArgs.read_only !== "true" && (
                          <ServiceTemplatesDialog
                            onSelection={(template) =>
                              addServiceFromTemplate(template)
                            }
                          />
                        )}
                      </Box>
                    ),
                  }[state.selectedTabIndex]
                }
              </div>

              <div className="top-buttons">
                <MDCButtonReact
                  classNames={["close-button"]}
                  icon="close"
                  onClick={closeSettings.bind(this)}
                />
              </div>
              {props.queryArgs.read_only !== "true" && (
                <div className="bottom-buttons observe-overflow">
                  <MDCButtonReact
                    label={state.unsavedChanges ? "SAVE*" : "SAVE"}
                    classNames={["mdc-button--raised", "themed-secondary"]}
                    onClick={saveGeneralForm.bind(this)}
                    icon="save"
                  />
                </div>
              )}
            </div>
          ) : (
            <MDCLinearProgressReact />
          )}
        </div>
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default PipelineSettingsView;
