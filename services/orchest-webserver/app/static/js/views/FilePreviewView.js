import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import PipelineView from "./PipelineView";
import { makeRequest, PromiseManager, makeCancelable } from "../lib/utils/all";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { Controlled as CodeMirror } from "react-codemirror2";
import {
  getPipelineJSONEndpoint,
  getPipelineStepParents,
  getPipelineStepChildren,
} from "../utils/webserver-utils";
require("codemirror/mode/python/python");
require("codemirror/mode/shell/shell");
require("codemirror/mode/r/r");

class FilePreviewView extends React.Component {
  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  loadPipelineView() {
    orchest.loadView(PipelineView, {
      pipeline_uuid: this.props.pipeline_uuid,
      project_uuid: this.props.project_uuid,
      readOnly: this.props.readOnly,
      pipelineRun: this.props.pipelineRun,
    });
  }

  componentDidMount() {
    this.fetchAll();
  }

  constructor(props) {
    super(props);

    this.MODE_MAPPING = {
      py: "text/x-python",
      sh: "text/x-sh",
      r: "text/x-rsrc",
    };

    this.state = {
      notebookHtml: undefined,
      textFile: undefined,
      loadingFile: true,
      parentSteps: [],
      childSteps: [],
    };

    this.promiseManager = new PromiseManager();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.step_uuid !== prevProps.step_uuid ||
      this.props.pipeline_uuid !== prevProps.pipeline_uuid ||
      this.props.pipelineRun !== prevProps.pipelineRun
    ) {
      this.fetchAll();
    }
  }

  fetchPipeline() {
    return new Promise((resolve, reject) => {
      this.setState({
        loadingFile: true,
        textFile: undefined,
      });

      let pipelineURL = this.props.pipelineRun
        ? getPipelineJSONEndpoint(
            this.props.pipeline_uuid,
            this.props.project_uuid,
            this.props.pipelineRun.experiment_uuid,
            this.props.pipelineRun.run_uuid
          )
        : getPipelineJSONEndpoint(
            this.props.pipeline_uuid,
            this.props.project_uuid
          );

      let fetchPipelinePromise = makeCancelable(
        makeRequest("GET", pipelineURL),
        this.promiseManager
      );

      fetchPipelinePromise.promise
        .then((response) => {
          let pipelineJSON = JSON.parse(JSON.parse(response)["pipeline_json"]);

          this.setState({
            parentSteps: getPipelineStepParents(
              this.props.step_uuid,
              pipelineJSON
            ),
            childSteps: getPipelineStepChildren(
              this.props.step_uuid,
              pipelineJSON
            ),
          });

          resolve();
        })
        .catch((err) => {
          console.log(err);
          reject();
        });
    });
  }

  fetchAll() {
    this.setState({
      loadingFile: true,
    });

    let fetchAllPromise = makeCancelable(
      Promise.all([this.fetchFile(), this.fetchPipeline()]),
      this.promiseManager
    );

    fetchAllPromise.promise.then(() => {
      this.setState({
        loadingFile: false,
      });
    });
  }

  fetchFile() {
    return new Promise((resolve, reject) => {
      this.setState({
        textFile: undefined,
      });

      let fileURL = `/async/file-viewer/${this.props.project_uuid}/${this.props.pipeline_uuid}/${this.props.step_uuid}`;
      if (this.props.pipelineRun) {
        fileURL += "?pipeline_run_uuid=" + this.props.pipelineRun.run_uuid;
        fileURL += "&experiment_uuid=" + this.props.pipelineRun.experiment_uuid;
      }

      let fetchFilePromise = makeCancelable(
        makeRequest("GET", fileURL),
        this.promiseManager
      );

      fetchFilePromise.promise
        .then((response) => {
          this.setState({
            textFile: JSON.parse(response),
          });
          resolve();
        })
        .catch((err) => {
          console.log(err);
          reject();
        });
    });
  }

  stepNavigate(stepUUID) {
    let propClone = JSON.parse(JSON.stringify(this.props));
    propClone.step_uuid = stepUUID;

    orchest.loadView(FilePreviewView, propClone);
  }

  renderNavStep(steps) {
    return steps.map((step) => (
      <button
        key={step.uuid}
        onClick={this.stepNavigate.bind(this, step.uuid)}
        className="text-button"
      >
        {step.title}
      </button>
    ));
  }

  render() {
    let parentStepElements = this.renderNavStep(this.state.parentSteps);
    let childStepElements = this.renderNavStep(this.state.childSteps);

    return (
      <div className={"view-page file-viewer no-padding"}>
        <div className="top-buttons">
          <MDCButtonReact
            classNames={["refresh-button padding-right"]}
            icon="refresh"
            onClick={this.fetchAll.bind(this)}
          />
          <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={this.loadPipelineView.bind(this)}
          />
        </div>

        {(() => {
          if (this.state.loadingFile) {
            return <MDCLinearProgressReact />;
          } else {
            let fileComponent;

            if (this.state.textFile.ext != "ipynb") {
              let fileMode = this.MODE_MAPPING[
                this.state.textFile.ext.toLowerCase()
              ];
              if (!fileMode) {
                fileMode = null;
              }

              fileComponent = (
                <CodeMirror
                  value={this.state.textFile.content}
                  options={{
                    mode: fileMode,
                    theme: "jupyter",
                    lineNumbers: true,
                    readOnly: true,
                  }}
                />
              );
            } else if (this.state.textFile.ext == "ipynb") {
              fileComponent = (
                <iframe
                  className={"notebook-iframe borderless fullsize"}
                  srcDoc={this.state.textFile.content}
                ></iframe>
              );
            } else {
              fileComponent = (
                <div>
                  <p>
                    Something went wrong loading the file. Please try again by
                    reloading the page.
                  </p>
                </div>
              );
            }

            return (
              <Fragment>
                <div className="file-description">
                  <h3>
                    Step: {this.state.textFile.step_title} (
                    {this.state.textFile.filename})
                  </h3>
                  <div className="step-navigation">
                    <div className="parents">
                      <span>Parent steps</span>
                      {parentStepElements}
                    </div>
                    <div className="children">
                      <span>Child steps</span>
                      {childStepElements}
                    </div>
                  </div>
                </div>
                <div className="file-holder">{fileComponent}</div>
                <p>
                  <i>Read only.</i>
                </p>
              </Fragment>
            );
          }
        })()}
      </div>
    );
  }
}

export default FilePreviewView;
