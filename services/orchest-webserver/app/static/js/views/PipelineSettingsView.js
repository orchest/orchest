import React from "react";
import PipelineView from "./PipelineView";
import { MDCTextField } from "@material/textfield";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";

class PipelineSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      active_tab_index: 0,
      restartingMemoryServer: false,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  initComponent() {
    this.initiateMDCComponents();
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
        this.setState({ pipelineJson: pipelineJson });

        this.initComponent();
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  initiateMDCComponents() {
    if (this.refManager.refs.pipelineNameField) {
      this.pipelineNameField = new MDCTextField(
        this.refManager.refs.pipelineNameField
      );
      this.pipelineNameField.value = this.state.pipelineJson.name;
      this.pipelineNameField.focus();
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    this.initiateMDCComponents();
  }

  closeSettings() {
    orchest.loadView(PipelineView, {
      project_uuid: this.props.project_uuid,
      pipeline_uuid: this.props.pipeline_uuid,
    });
  }

  saveGeneralForm(e) {
    e.preventDefault();

    // new name
    let pipelineName = this.pipelineNameField.value;

    let formData = new FormData();
    formData.append("name", pipelineName);

    // perform POST to save
    makeRequest(
      "POST",
      `/async/pipelines/rename/${this.props.project_uuid}/${this.props.pipeline_uuid}`,
      { type: "FormData", content: formData }
    ).then((response) => {
      let json = JSON.parse(response);
      console.log(json);
      if (json.success === true) {
        orchest.loadView(PipelineView, {
          pipeline_uuid: this.props.pipeline_uuid,
          project_uuid: this.props.project_uuid,
        });
      }
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
          `/api-proxy/api/sessions/${this.props.project_uuid}/${this.props.pipeline_uuid}`
        ),
        this.promiseManager
      );

      restartPromise.promise.then((response) => {
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

        <MDCTabBarReact items={["General"]} icons={["subject"]} />

        <div className={"tab-content"}>
          {(() => {
            switch (this.state.active_tab_index) {
              case 0:
                return (
                  <div>
                    <form>
                      <div>
                        <div
                          ref={this.refManager.nrefs.pipelineNameField}
                          className="mdc-text-field"
                        >
                          <input
                            type="text"
                            id="my-text-field"
                            onChange={this.stub}
                            className="mdc-text-field__input"
                          />
                          <label
                            className="mdc-floating-label"
                            htmlFor="my-text-field"
                          >
                            Pipeline name
                          </label>
                          <div className="mdc-line-ripple"></div>
                        </div>
                      </div>

                      <MDCButtonReact
                        label="save"
                        classNames={["mdc-button--raised"]}
                        onClick={this.saveGeneralForm.bind(this)}
                      />
                    </form>

                    <h3 className="push-up push-down">Data passing</h3>

                    <MDCButtonReact
                      disabled={this.state.restartingMemoryServer}
                      label="Clear memory"
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
                  </div>
                );
            }
          })()}
        </div>

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
