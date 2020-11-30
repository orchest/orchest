import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import PipelineView from "./PipelineView";
import { makeRequest, PromiseManager, makeCancelable } from "../lib/utils/all";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import { Controlled as CodeMirror } from "react-codemirror2";
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
    this.fetchFile();
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
    };

    this.promiseManager = new PromiseManager();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.step_uuid !== prevProps.step_uuid &&
      this.props.pipeline_uuid !== prevProps.pipeline_uuid
    ) {
      this.fetchFile();
    }
  }

  fetchFile() {
    let notebookURL = `/async/file-viewer/${this.props.project_uuid}/${this.props.pipeline_uuid}/${this.props.step_uuid}`;

    if (this.props.pipelineRun) {
      notebookURL += "?pipeline_run_uuid=" + this.props.pipelineRun.run_uuid;
      notebookURL +=
        "&experiment_uuid=" + this.props.pipelineRun.experiment_uuid;
    }

    let fetchFilePromise = makeCancelable(
      makeRequest("GET", notebookURL),
      this.promiseManager
    );

    fetchFilePromise.promise
      .then((response) => {
        this.setState({
          loadingFile: false,
          textFile: JSON.parse(response),
        });
      })
      .catch((err) => {
        console.log(err);
      });
  }

  render() {
    return (
      <div className={"view-page file-viewer no-padding"}>
        <MDCButtonReact
          classNames={["close-button"]}
          icon="close"
          onClick={this.loadPipelineView.bind(this)}
        />

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
                  <h2>Filename: {this.state.textFile.filename}</h2>
                  <h4>Step: {this.state.textFile.step_title}</h4>
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
