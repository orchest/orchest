import React from "react";
import PipelineView from "./PipelineView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";

class PipelineSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      restartingMemoryServer: false,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    let pipelinePromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/pipelines/json/${this.props.project_uuid}/${this.props.pipeline_uuid}`
      ),
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

        this.setState({ pipelineJson: pipelineJson });
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {}

  closeSettings() {
    orchest.loadView(PipelineView, {
      project_uuid: this.props.project_uuid,
      pipeline_uuid: this.props.pipeline_uuid,
    });
  }

  onChangeName(value) {
    this.state.pipelineJson.name = value;
  }

  onChangeDataPassingMemorySize(value) {
    this.state.pipelineJson.settings.data_passing_memory_size = value;
  }

  onChangeEviction(value) {
    // create settings object if it doesn't exist
    if (!this.state.pipelineJson.settings) {
      this.state.pipelineJson.settings = {};
    }

    this.state.pipelineJson.settings.auto_eviction = value;
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
        orchest.loadView(PipelineView, {
          pipeline_uuid: this.props.pipeline_uuid,
          project_uuid: this.props.project_uuid,
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
                <form>
                  <div>
                    <MDCTextFieldReact
                      ref={this.refManager.nrefs.pipelineNameTextField}
                      value={this.state.pipelineJson.name}
                      onChange={this.onChangeName.bind(this)}
                      label="Pipeline name"
                      classNames={["push-down"]}
                    />

                    <h3>Data passing</h3>

                    <MDCCheckboxReact
                      value={this.state.pipelineJson.settings.auto_eviction}
                      onChange={this.onChangeEviction.bind(this)}
                      label="Automatic memory eviction"
                      classNames={["push-down", "push-up"]}
                    />

                    <p className="push-down">
                      Change the size of the memory server for data passing. For
                      units use KB, MB, or GB. E.g.{" "}
                      <span className="code">1GB</span>.{" "}
                      <i>
                        Changing this setting requires you to restart the
                        session.
                      </i>
                    </p>
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
                    />
                  </div>

                  <MDCButtonReact
                    label="save"
                    classNames={["mdc-button--raised"]}
                    onClick={this.saveGeneralForm.bind(this)}
                  />
                </form>

                <h3 className="push-up push-down">Actions</h3>

                <p className="push-down">
                  Clear the memory of the pipeline to allow additional data to
                  be passed between pipeline steps.
                </p>
                <MDCButtonReact
                  disabled={this.state.restartingMemoryServer}
                  label="Clear memory"
                  icon="memory"
                  classNames={["mdc-button--raised"]}
                  onClick={this.restartMemoryServer.bind(this)}
                />

                {(() => {
                  if (this.state.restartingMemoryServer) {
                    return <p className="push-up">Restarting in progress...</p>;
                  }
                })()}
              </div>
            );
          } else {
            return <MDCLinearProgressReact />;
          }
        })()}

        <MDCButtonReact
          classNames={["close-button"]}
          icon="close"
          onClick={this.closeSettings.bind(this)}
        />
      </div>
    );
  }
}

export default PipelineSettingsView;
