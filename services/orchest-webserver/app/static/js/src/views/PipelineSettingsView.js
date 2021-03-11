import React from "react";
import PipelineView from "./PipelineView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import {
  getPipelineJSONEndpoint,
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
  updateGlobalUnsavedChanges,
} from "../utils/webserver-utils";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { Controlled as CodeMirror } from "react-codemirror2";
import EnvVarList from "../components/EnvVarList";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import "codemirror/mode/javascript/javascript";

class PipelineSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTabIndex: 0,
      inputParameters: JSON.stringify({}, null, 2),
      restartingMemoryServer: false,
      unsavedChanges: false,
      pipeline_path: undefined,
    };

    this.overflowListener = new OverflowListener();
    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchPipeline();
    this.fetchPipelineMetadata();
    this.attachResizeListener();
  }

  componentDidUpdate() {
    this.attachResizeListener();
  }

  attachResizeListener() {
    this.overflowListener.attach();
  }

  onSelectSubview(index) {
    this.setState({
      selectedTabIndex: index,
    });
  }

  fetchPipeline() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.props.queryArgs.pipeline_uuid,
      this.props.queryArgs.project_uuid,
      this.props.queryArgs.job_uuid,
      this.props.queryArgs.run_uuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      this.promiseManager
    );

    pipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);

      if (result.success) {
        let pipelineJson = JSON.parse(result["pipeline_json"]);

        // as settings are optional, populate defaults if no values exist
        if (pipelineJson.settings === undefined) {
          pipelineJson.settings = {};
        }
        if (pipelineJson.settings.auto_eviction === undefined) {
          pipelineJson.settings.auto_eviction = false;
        }
        if (pipelineJson.settings.data_passing_memory_size === undefined) {
          pipelineJson.settings.data_passing_memory_size = "1GB";
        }
        this.state.inputParameters = JSON.stringify(
          pipelineJson.parameters,
          null,
          2
        );
        this.setState({ pipelineJson: pipelineJson });
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  fetchPipelineMetadata() {
    if (!this.props.queryArgs.job_uuid) {
      // get pipeline path
      let cancelableRequest = makeCancelable(
        makeRequest(
          "GET",
          `/async/pipelines/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`
        ),
        this.promiseManager
      );

      cancelableRequest.promise.then((response) => {
        let pipeline = JSON.parse(response);

        this.setState({
          pipeline_path: pipeline.path,
          envVariables: envVariablesDictToArray(pipeline["env_variables"]),
        });
      });

      // get project environment variables
      let cancelableProjectRequest = makeCancelable(
        makeRequest(
          "GET",
          `/async/projects/${this.props.queryArgs.project_uuid}`
        ),
        this.promiseManager
      );

      cancelableProjectRequest.promise
        .then((response) => {
          let project = JSON.parse(response);

          this.setState({
            projectEnvVariables: envVariablesDictToArray(
              project["env_variables"]
            ),
          });
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      let cancelableJobPromise = makeCancelable(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${this.props.queryArgs.job_uuid}`
        ),
        this.promiseManager
      );
      let cancelableRunPromise = makeCancelable(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${this.props.queryArgs.job_uuid}/${this.props.queryArgs.run_uuid}`
        ),
        this.promiseManager
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
      ]).then((values) => {
        let [pipeline_path, envVariables] = values;
        this.setState({
          pipeline_path: pipeline_path,
          envVariables: envVariables,
        });
      });
    }
  }

  closeSettings() {
    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: this.props.queryArgs.pipeline_uuid,
        project_uuid: this.props.queryArgs.project_uuid,
        read_only: this.props.queryArgs.read_only,
        job_uuid: this.props.queryArgs.job_uuid,
        run_uuid: this.props.queryArgs.run_uuid,
      },
    });
  }

  onChangeName(value) {
    this.state.pipelineJson.name = value;
    this.setState({
      unsavedChanges: true,
    });
  }

  onChangePipelineParameters(editor, data, value) {
    this.state.inputParameters = value;
    this.setState({
      inputParamaters: value,
    });

    try {
      this.state.pipelineJson.parameters = JSON.parse(value);
      this.setState({
        unsavedChanges: true,
      });
    } catch (err) {
      // console.log("JSON did not parse")
    }
  }

  onChangeDataPassingMemorySize(value) {
    this.state.pipelineJson.settings.data_passing_memory_size = value;
    this.setState({
      unsavedChanges: true,
    });
  }

  onChangeEviction(value) {
    // create settings object if it doesn't exist
    if (!this.state.pipelineJson.settings) {
      this.state.pipelineJson.settings = {};
    }

    this.state.pipelineJson.settings.auto_eviction = value;
    this.setState({
      unsavedChanges: true,
    });
  }

  addEnvVariablePair(e) {
    e.preventDefault();

    const envVariables = this.state.envVariables.slice();
    this.setState({
      envVariables: envVariables.concat([
        {
          name: null,
          value: null,
        },
      ]),
    });
  }

  onEnvVariablesChange(value, idx, type) {
    const envVariables = this.state.envVariables.slice();
    envVariables[idx][type] = value;

    this.setState({
      envVariables: envVariables,
      unsavedChanges: true,
    });
  }

  onEnvVariablesDeletion(idx) {
    const envVariables = this.state.envVariables.slice();
    envVariables.splice(idx, 1);
    this.setState({
      envVariables: envVariables,
      unsavedChanges: true,
    });
  }

  saveGeneralForm(e) {
    e.preventDefault();

    let envVariables = envVariablesArrayToDict(this.state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      this.onSelectSubview(1);
      return;
    }

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(this.state.pipelineJson));

    // perform POST to save
    makeRequest(
      "POST",
      `/async/pipelines/json/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`,
      { type: "FormData", content: formData }
    )
      .then(() => {
        this.setState({
          unsavedChanges: false,
        });
      })
      .catch((response) => {
        console.error(response);
      });

    makeRequest(
      "PUT",
      `/async/pipelines/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`,
      {
        type: "json",
        content: { env_variables: envVariables },
      }
    ).catch((response) => {
      console.error(response);
    });
  }

  restartMemoryServer() {
    if (!this.state.restartingMemoryServer) {
      this.setState({
        restartingMemoryServer: true,
      });

      // perform POST to save
      let restartPromise = makeCancelable(
        makeRequest(
          "PUT",
          `/catch/api-proxy/api/sessions/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`
        ),
        this.promiseManager
      );

      restartPromise.promise
        .then(() => {
          this.setState({
            restartingMemoryServer: false,
          });
        })
        .catch((response) => {
          if (!response.isCanceled) {
            let errorMessage =
              "Could not clear memory server, reason unknown. Please try again later.";
            try {
              errorMessage = JSON.parse(response.body)["message"];
            } catch (error) {
              console.error(error);
            }
            orchest.alert("Error", errorMessage);

            this.setState({
              restartingMemoryServer: false,
            });
          }
        });
    } else {
      console.error(
        "Already busy restarting memory server. UI should prohibit this call."
      );
    }
  }

  render() {
    let rootView = undefined;
    updateGlobalUnsavedChanges(this.state.unsavedChanges);

    if (
      this.state.pipelineJson &&
      this.state.envVariables &&
      (this.props.queryArgs.read_only === "true" ||
        this.state.projectEnvVariables)
    ) {
      let tabView = undefined;

      switch (this.state.selectedTabIndex) {
        case 0:
          tabView = (
            <div className="pipeline-settings">
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
                      ref={this.refManager.nrefs.pipelineNameTextField}
                      value={this.state.pipelineJson.name}
                      onChange={this.onChangeName.bind(this)}
                      label="Pipeline name"
                      disabled={this.props.queryArgs.read_only === "true"}
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
                    {this.state.pipeline_path && (
                      <p className="push-down">
                        <span className="code">{this.state.pipeline_path}</span>
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
                      value={this.state.inputParameters}
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                        readOnly: this.props.queryArgs.read_only === "true",
                      }}
                      onBeforeChange={this.onChangePipelineParameters.bind(
                        this
                      )}
                    />
                    {(() => {
                      try {
                        JSON.parse(this.state.inputParameters);
                      } catch {
                        return (
                          <div className="warning push-up push-down">
                            <i className="material-icons">warning</i> Your input
                            is not valid JSON.
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
                    {this.props.queryArgs.read_only !== "true" && (
                      <p className="push-up">
                        <i>
                          For these changes to take effect you have to restart
                          the memory-server (see button below).
                        </i>
                      </p>
                    )}

                    <MDCCheckboxReact
                      value={this.state.pipelineJson.settings.auto_eviction}
                      onChange={this.onChangeEviction.bind(this)}
                      label="Automatic memory eviction"
                      disabled={this.props.queryArgs.read_only === "true"}
                      classNames={["push-down", "push-up"]}
                    />

                    {this.props.queryArgs.read_only !== "true" && (
                      <p className="push-down">
                        Change the size of the memory server for data passing.
                        For units use KB, MB, or GB, e.g.{" "}
                        <span className="code">1GB</span>.{" "}
                      </p>
                    )}

                    <div>
                      <MDCTextFieldReact
                        ref={
                          this.refManager.nrefs
                            .pipelineSettingDataPassingMemorySizeTextField
                        }
                        value={
                          this.state.pipelineJson.settings
                            .data_passing_memory_size
                        }
                        onChange={this.onChangeDataPassingMemorySize.bind(this)}
                        label="Data passing memory size"
                        disabled={this.props.queryArgs.read_only === "true"}
                      />
                    </div>
                  </div>
                  <div className="clear"></div>
                </div>
              </form>

              {this.props.queryArgs.read_only !== "true" && (
                <div className="columns">
                  <div className="column">
                    <h3>Actions</h3>
                  </div>
                  <div className="column">
                    <p className="push-down">
                      Restarting the memory-server also clears the memory to
                      allow additional data to be passed between pipeline steps.
                    </p>
                    <div className="push-down">
                      {(() => {
                        if (this.state.restartingMemoryServer) {
                          return (
                            <p className="push-p push-down">
                              Restarting in progress...
                            </p>
                          );
                        }
                      })()}

                      <MDCButtonReact
                        disabled={this.state.restartingMemoryServer}
                        label="Restart memory-server"
                        icon="memory"
                        classNames={["mdc-button--raised push-down"]}
                        onClick={this.restartMemoryServer.bind(this)}
                      />
                    </div>
                  </div>
                  <div className="clear"></div>
                </div>
              )}
            </div>
          );
          break;
        case 1:
          tabView = (
            <div>
              {(() => {
                if (this.props.queryArgs.read_only === "true") {
                  return (
                    <>
                      <EnvVarList
                        value={this.state.envVariables}
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
                        value={this.state.projectEnvVariables}
                        readOnly={true}
                      />

                      <h3 className="push-down">
                        Pipeline environment variables
                      </h3>
                      <p className="push-down">
                        Pipeline environment variables take precedence over
                        project environment variables.
                      </p>
                      <EnvVarList
                        value={this.state.envVariables}
                        onAdd={this.addEnvVariablePair.bind(this)}
                        onChange={(e, idx, type) =>
                          this.onEnvVariablesChange(e, idx, type)
                        }
                        onDelete={(idx) => this.onEnvVariablesDeletion(idx)}
                      />
                      <p>
                        <i>
                          Note: restarting the session is required to update
                          environment variables in Jupyter kernels.
                        </i>
                      </p>
                    </>
                  );
                }
              })()}
            </div>
          );
          break;
      }

      rootView = (
        <div className="pipeline-settings">
          <h2>Pipeline settings</h2>

          <div className="push-down">
            <MDCTabBarReact
              selectedIndex={this.state.selectedTabIndex}
              ref={this.refManager.nrefs.tabBar}
              items={["Configuration", "Environment variables"]}
              icons={["list", "view_comfy"]}
              onChange={this.onSelectSubview.bind(this)}
            />
          </div>

          <div className="tab-view trigger-overflow">{tabView}</div>

          <div className="top-buttons">
            <MDCButtonReact
              classNames={["close-button"]}
              icon="close"
              onClick={this.closeSettings.bind(this)}
            />
          </div>
          {this.props.queryArgs.read_only !== "true" && (
            <div className="bottom-buttons observe-overflow">
              <MDCButtonReact
                label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={this.saveGeneralForm.bind(this)}
                icon="save"
              />
            </div>
          )}
        </div>
      );
    } else {
      rootView = <MDCLinearProgressReact />;
    }

    return <div className="view-page pipeline-settings-view">{rootView}</div>;
  }
}

export default PipelineSettingsView;
