import React from "react";
import PipelineView from "./PipelineView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { Controlled as CodeMirror } from "react-codemirror2";
require("codemirror/mode/javascript/javascript");

class PipelineSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      inputParameters: JSON.stringify({}, null, 2),
      restartingMemoryServer: false,
      unsavedChanges: false,
      pipeline_path: undefined,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchPipeline();
    this.fetchPipelinePath();
  }

  fetchPipeline() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.props.pipeline_uuid,
      this.props.project_uuid,
      this.props.pipelineRun && this.props.pipelineRun.job_uuid,
      this.props.pipelineRun && this.props.pipelineRun.uuid
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

  fetchPipelinePath() {
    if (!this.props.pipelineRun) {
      // get pipeline path
      let fetchPipelinePathPromise = makeCancelable(
        makeRequest(
          "GET",
          `/async/pipelines/${this.props.project_uuid}/${this.props.pipeline_uuid}`
        ),
        this.promiseManager
      );

      fetchPipelinePathPromise.promise.then((response) => {
        let pipeline = JSON.parse(response);
        this.setState({
          pipeline_path: pipeline.path,
        });
      });
    } else {
      let fetchPipelinePathPromise = makeCancelable(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${this.props.pipelineRun.job_uuid}`
        ),
        this.promiseManager
      );

      fetchPipelinePathPromise.promise.then((response) => {
        let job = JSON.parse(response);
        this.setState({
          pipeline_path: job.pipeline_run_spec.run_config.pipeline_path,
        });
      });
    }
  }

  closeSettings() {
    orchest.loadView(PipelineView, {
      pipeline_uuid: this.props.pipeline_uuid,
      project_uuid: this.props.project_uuid,
      readOnly: this.props.readOnly,
      pipelineRun: this.props.pipelineRun,
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

  saveGeneralForm(e) {
    e.preventDefault();

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(this.state.pipelineJson));

    // perform POST to save
    makeRequest(
      "POST",
      `/async/pipelines/json/${this.props.project_uuid}/${this.props.pipeline_uuid}`,
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
          `/catch/api-proxy/api/sessions/${this.props.project_uuid}/${this.props.pipeline_uuid}`
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
        });
    } else {
      console.error(
        "Already busy restarting memory server. UI should prohibit this call."
      );
    }
  }

  render() {
    return (
      <div className={"view-page view-pipeline-settings"}>
        <h2>Pipeline settings</h2>

        {(() => {
          if (this.state.pipelineJson) {
            return (
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <MDCTextFieldReact
                      ref={this.refManager.nrefs.pipelineNameTextField}
                      value={this.state.pipelineJson.name}
                      onChange={this.onChangeName.bind(this)}
                      label="Pipeline name"
                      disabled={this.props.readOnly === true}
                      classNames={["push-down"]}
                    />
                    {this.state.pipeline_path && (
                      <p className="push-down">
                        Pipeline path:{" "}
                        <span className="code">{this.state.pipeline_path}</span>
                      </p>
                    )}

                    <h3 className="push-down">Pipeline parameters</h3>

                    <CodeMirror
                      value={this.state.inputParameters}
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                        readOnly: this.props.readOnly === true,
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

                    <h3 className="push-up">Data passing</h3>
                    {!this.props.readOnly && (
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
                      disabled={this.props.readOnly === true}
                      classNames={["push-down", "push-up"]}
                    />

                    {!this.props.readOnly && (
                      <p className="push-down">
                        Change the size of the memory server for data passing.
                        For units use KB, MB, or GB, e.g.{" "}
                        <span className="code">1GB</span>.{" "}
                      </p>
                    )}
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
                      disabled={this.props.readOnly === true}
                    />
                  </div>

                  {!this.props.readOnly && (
                    <MDCButtonReact
                      label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                      classNames={["mdc-button--raised"]}
                      onClick={this.saveGeneralForm.bind(this)}
                    />
                  )}
                </form>

                {!this.props.readOnly && (
                  <>
                    <h3 className="push-up push-down">Actions</h3>

                    <p className="push-down">
                      Restarting the memory-server also clears the memory to
                      allow additional data to be passed between pipeline steps.
                    </p>
                    <MDCButtonReact
                      disabled={this.state.restartingMemoryServer}
                      label="Restart memory-server"
                      icon="memory"
                      classNames={["mdc-button--raised"]}
                      onClick={this.restartMemoryServer.bind(this)}
                    />

                    {(() => {
                      if (this.state.restartingMemoryServer) {
                        return (
                          <p className="push-up">Restarting in progress...</p>
                        );
                      }
                    })()}
                  </>
                )}
              </div>
            );
          } else {
            return <MDCLinearProgressReact />;
          }
        })()}

        <div className="top-buttons">
          <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={this.closeSettings.bind(this)}
          />
        </div>
      </div>
    );
  }
}

export default PipelineSettingsView;
