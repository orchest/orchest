// @ts-check
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import _ from "lodash";
import "codemirror/mode/javascript/javascript";
import {
  css,
  Box,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  IconDraftOutline,
  IconServicesSolid,
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
} from "@orchest/lib-mdc";
import { useOrchest, OrchestSessionsConsumer } from "@/hooks/orchest";
import {
  getPipelineJSONEndpoint,
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
  updateGlobalUnsavedChanges,
} from "@/utils/webserver-utils";
import EnvVarList from "@/components/EnvVarList";
import ServiceForm from "@/components/ServiceForm";
import {
  IconPostgreSQL,
  IconPyTorch,
  IconRedis,
  IconStreamlit,
  IconTensorBoard,
  IconVSCode,
} from "@/icons";
import PipelineView from "./PipelineView";

/**
 * @typedef {{binds?: {[key: string]: string}}} TServiceConfigBinds
 * @typedef {{env_variables?: {[key: string]: string}}} TServiceConfigEnv
 * @typedef {{ports?: number[]}} TServiceConfigPorts
 * @typedef {{scope?: ("interactive"|"noninteractive")[]}} TServiceConfigScope
 * @typedef { Partial<Record<"command"|"image"|"name", string>>
 *  & TServiceConfigBinds
 *  & TServiceConfigEnv
 *  & TServiceConfigPorts
 *  & TServiceConfigScope
 * } TServiceConfig
 * @type {{[key: string]: {label: string, icon?: React.ReactNode, config?: TServiceConfig}}} servicesTemplates */
const servicesTemplates = {
  tensorboard: {
    label: "TensorBoard",
    icon: <IconTensorBoard />,
    config: {
      binds: {
        "/data": "/data",
      },
      command: "tensorboard --logdir /data --bind_all",
      image: "tensorflow/tensorflow",
      name: "tensorboard",
      ports: [6006],
      scope: ["interactive"],
    },
  },
  pytorchTensorboard: {
    label: "PyTorch TensorBoard",
    icon: <IconPyTorch />,
  },
  streamlit: { label: "Streamlit", icon: <IconStreamlit /> },
  vscode: {
    label: "VSCode",
    icon: <IconVSCode />,
    config: {
      binds: {
        "/project-dir": "/home/coder/project",
      },
      command: "code-server --auth none",
      image: "codercom/code-server:latest",
      name: "code-server",
      ports: [8080],
      scope: ["interactive"],
    },
  },
  postgressql: {
    label: "PostgresSQL",
    icon: <IconPostgreSQL />,
    config: {
      env_variables: {
        POSTGRES_HOST_AUTH_METHOD: "trust",
      },
      image: "postgres",
      name: "postgres",
      scope: ["interactive", "noninteractive"],
    },
  },
  redis: {
    label: "Redis",
    icon: <IconRedis />,
    config: {
      image: "redis",
      name: "redis",
      scope: ["interactive", "noninteractive"],
    },
  },
  empty: {
    label: "Create custom service",
    icon: <IconDraftOutline />,
  },
};

// we'll extract this into the design-system later
const createServiceButton = css({
  appearance: "none",
  display: "inline-flex",
  backgroundColor: "$background",
  border: "1px solid $gray300",
  borderRadius: "$sm",
  width: "100%",
  padding: "$3",
  transition: "0.2s ease",
  textAlign: "left",
  "&:hover&:not(:disabled)": {
    backgroundColor: "$gray100",
  },
  "> *:first-child": {
    flexShrink: 0,
    color: "$gray600",
    marginRight: "$3",
  },
});

const PipelineSettingsView = (props) => {
  const orchest = window.orchest;

  const { dispatch } = useOrchest();

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
  const [
    isServiceCreateDialogOpen,
    setIsServiceCreateDialogOpen,
  ] = React.useState(false);

  const overflowListener = new OverflowListener();
  const promiseManager = new PromiseManager();
  const refManager = new RefManager();

  const init = () => {
    fetchPipeline();
    fetchPipelineMetadata();
    attachResizeListener();
  };

  React.useEffect(() => {
    init();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    init();
  }, [props.queryArgs]);

  const setHeaderComponent = (pipelineName) =>
    dispatch({
      type: "pipelineSet",
      payload: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        pipelineName: pipelineName,
      },
    });

  const onChangeService = (service) => {
    let pipelineJson = _.cloneDeep(state.pipelineJson);
    pipelineJson.services[service.name] = service;

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
        parameters: parametersJSON,
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

  const saveGeneralForm = (e) => {
    console.log(state);

    e.preventDefault();

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      onSelectSubview(1);
      return;
    }

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(state.pipelineJson));

    // perform POST to save
    makeRequest(
      "POST",
      `/async/pipelines/json/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`,
      { type: "FormData", content: formData }
    )
      .then(
        /** @param {string} response */
        (response) => {
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
                pipelineName: state.pipelineJson?.name,
              },
            });
          } else {
            console.error("Could not save pipeline.json");
            console.error(result);
          }
        }
      )
      .catch((response) => {
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

  updateGlobalUnsavedChanges(state.unsavedChanges);

  return (
    <OrchestSessionsConsumer>
      <div className="view-page pipeline-settings-view">
        {state.pipelineJson &&
        state.envVariables &&
        (props.queryArgs.read_only === "true" || state.projectEnvVariables) ? (
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
                              ref={
                                // @ts-ignore
                                refManager.nrefs.pipelineNameTextField
                              }
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
                                readOnly: props.queryArgs.read_only === "true",
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
                                  restart the memory-server (see button below).
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
                                ref={
                                  refManager.nrefs // @ts-ignore
                                    .pipelineSettingDataPassingMemorySizeTextField
                                }
                                value={state.dataPassingMemorySize}
                                onChange={onChangeDataPassingMemorySize.bind(
                                  this
                                )}
                                label="Data passing memory size"
                                disabled={props.queryArgs.read_only === "true"}
                              />
                            </div>
                            {(() => {
                              if (
                                !isValidMemorySize(state.dataPassingMemorySize)
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
                                onDelete={(idx) => onEnvVariablesDeletion(idx)}
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
                      {state.servicesChanged && (
                        <div className="warning push-up">
                          <i className="material-icons">warning</i>
                          Note: changes to services require a session restart to
                          take effect.
                        </div>
                      )}
                      <MDCDataTableReact
                        headers={["Service", "Scope"]}
                        rows={Object.keys(state.pipelineJson.services)
                          .map(
                            (serviceName) =>
                              state.pipelineJson.services[serviceName]
                          )
                          .map((service) => [
                            service.name,
                            service.scope
                              .map((scope) => {
                                const scopeMap = {
                                  interactive: "Interactive",
                                  noninteractive: "Non-interactive",
                                };
                                return scopeMap[scope];
                              })
                              .sort()
                              .join(", "),
                          ])}
                        detailRows={Object.keys(state.pipelineJson.services)
                          .map(
                            (serviceName) =>
                              state.pipelineJson.services[serviceName]
                          )
                          .map((service, i) => (
                            <ServiceForm
                              key={["ServiceForm", i].join("-")}
                              service={service}
                              updateService={onChangeService}
                              pipeline_uuid={props.queryArgs.pipeline_uuid}
                              project_uuid={props.queryArgs.project_uuid}
                              run_uuid={props.queryArgs.run_uuid}
                            />
                          ))}
                      />

                      <Dialog
                        open={isServiceCreateDialogOpen}
                        onOpenChange={(open) =>
                          setIsServiceCreateDialogOpen(open)
                        }
                      >
                        <MDCButtonReact
                          icon="add"
                          classNames={["mdc-button--raised", "themed-primary"]}
                          label="Add Service"
                          onClick={() => setIsServiceCreateDialogOpen(true)}
                        />

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create a service</DialogTitle>
                          </DialogHeader>
                          <DialogBody>
                            <Flex as="ul" direction="column" gap="2">
                              {Object.keys(servicesTemplates).map((item) => {
                                const template = servicesTemplates[item];
                                return (
                                  <li key={item}>
                                    <button
                                      disabled={!template.config}
                                      className={createServiceButton()}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        onChangeService(template.config);
                                        setIsServiceCreateDialogOpen(false);
                                      }}
                                    >
                                      {template?.icon || <IconServicesSolid />}
                                      {template.label}
                                    </button>
                                  </li>
                                );
                              })}
                            </Flex>
                          </DialogBody>
                          <DialogFooter>
                            <MDCButtonReact
                              icon="close"
                              label="Cancel"
                              onClick={() =>
                                setIsServiceCreateDialogOpen(false)
                              }
                            />
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
    </OrchestSessionsConsumer>
  );
};

export default PipelineSettingsView;
