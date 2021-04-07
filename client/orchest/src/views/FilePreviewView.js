import React, { Fragment } from "react";
import { MDCButtonReact, MDCLinearProgressReact } from "@lib/mdc";
import PipelineView from "./PipelineView";
import {
  makeRequest,
  PromiseManager,
  RefManager,
  makeCancelable,
} from "@lib/utils";
import { Controlled as CodeMirror } from "react-codemirror2";
import {
  getPipelineJSONEndpoint,
  getPipelineStepParents,
  getPipelineStepChildren,
  setWithRetry,
} from "../utils/webserver-utils";
import "codemirror/mode/python/python";
import "codemirror/mode/shell/shell";
import "codemirror/mode/r/r";

class FilePreviewView extends React.Component {
  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();

    for (let interval of this.retryIntervals) {
      clearInterval(interval);
    }
  }

  loadPipelineView() {
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

  componentDidMount() {
    this.loadFile();
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
      fileDescription: undefined,
      loadingFile: true,
      parentSteps: [],
      childSteps: [],
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
    this.retryIntervals = [];
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.queryArgs.step_uuid !== prevProps.queryArgs.step_uuid ||
      this.props.queryArgs.pipeline_uuid !== prevProps.queryArgs.pipeline_uuid
    ) {
      // Clear old state
      this.setState(
        {
          fileDescription: undefined,
          notebookHtml: undefined,
        },
        () => {
          this.loadFile();
        }
      );
    }
  }

  fetchPipeline() {
    return new Promise((resolve, reject) => {
      this.setState({
        loadingFile: true,
      });

      let pipelineURL = this.props.queryArgs.job_uuid
        ? getPipelineJSONEndpoint(
            this.props.queryArgs.pipeline_uuid,
            this.props.queryArgs.project_uuid,
            this.props.queryArgs.job_uuid,
            this.props.queryArgs.run_uuid
          )
        : getPipelineJSONEndpoint(
            this.props.queryArgs.pipeline_uuid,
            this.props.queryArgs.project_uuid
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
              this.props.queryArgs.step_uuid,
              pipelineJSON
            ),
            childSteps: getPipelineStepChildren(
              this.props.queryArgs.step_uuid,
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
    return new Promise((resolve, reject) => {
      this.setState({
        loadingFile: true,
      });

      let fetchAllPromise = makeCancelable(
        Promise.all([this.fetchFile(), this.fetchPipeline()]),
        this.promiseManager
      );

      fetchAllPromise.promise
        .then(() => {
          this.setState({
            loadingFile: false,
          });
          resolve();
        })
        .catch(() => {
          this.setState({
            loadingFile: false,
          });
          reject();
        });
    });
  }

  fetchFile() {
    return new Promise((resolve, reject) => {
      let fileURL = `/async/file-viewer/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}/${this.props.queryArgs.step_uuid}`;
      if (this.props.queryArgs.run_uuid) {
        fileURL += "?pipeline_run_uuid=" + this.props.queryArgs.run_uuid;
        fileURL += "&job_uuid=" + this.props.queryArgs.job_uuid;
      }

      let fetchFilePromise = makeCancelable(
        makeRequest("GET", fileURL),
        this.promiseManager
      );

      fetchFilePromise.promise
        .then((response) => {
          this.setState({
            fileDescription: JSON.parse(response),
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
    propClone.queryArgs.step_uuid = stepUUID;

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

  restorePreviousScrollPosition() {
    if (
      this.state.fileDescription.ext == "ipynb" &&
      this.refManager.refs.htmlNotebookIframe
    ) {
      this.retryIntervals.push(
        setWithRetry(
          this.cachedScrollPosition,
          (value) => {
            this.refManager.refs.htmlNotebookIframe.contentWindow.scrollTo(
              this.refManager.refs.htmlNotebookIframe.contentWindow.scrollX,
              value
            );
          },
          () => {
            return this.refManager.refs.htmlNotebookIframe.contentWindow
              .scrollY;
          },
          25,
          100
        )
      );
    } else if (this.refManager.refs.fileViewer) {
      this.retryIntervals.push(
        setWithRetry(
          this.cachedScrollPosition,
          (value) => {
            this.refManager.refs.fileViewer.scrollTop = value;
          },
          () => {
            return this.refManager.refs.fileViewer.scrollTop;
          },
          25,
          100
        )
      );
    }
  }

  loadFile() {
    // cache scroll position
    let attemptRestore = false;

    if (this.state.fileDescription) {
      // File was loaded before, requires restoring scroll position.
      attemptRestore = true;
      this.cachedScrollPosition = 0;
      if (
        this.state.fileDescription.ext == "ipynb" &&
        this.refManager.refs.htmlNotebookIframe
      ) {
        this.cachedScrollPosition = this.refManager.refs.htmlNotebookIframe.contentWindow.scrollY;
      } else if (this.refManager.refs.fileViewer) {
        this.cachedScrollPosition = this.refManager.refs.fileViewer.scrollTop;
      }
    }

    this.fetchAll()
      .then(() => {
        if (attemptRestore) {
          this.restorePreviousScrollPosition();
        }
      })
      .catch(() => {
        orchest.alert(
          "Error",
          "Failed to load file. Make sure the path of the pipeline step is correct."
        );
      });
  }

  render() {
    let parentStepElements = this.renderNavStep(this.state.parentSteps);
    let childStepElements = this.renderNavStep(this.state.childSteps);

    return (
      <div
        className={"view-page file-viewer no-padding"}
        ref={this.refManager.nrefs.fileViewer}
      >
        <div className="top-buttons">
          <MDCButtonReact
            classNames={["refresh-button"]}
            icon="refresh"
            onClick={this.loadFile.bind(this)}
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
          } else if (
            this.state.fileDescription != undefined &&
            this.state.parentSteps != undefined
          ) {
            let fileComponent;

            if (this.state.fileDescription.ext != "ipynb") {
              let fileMode = this.MODE_MAPPING[
                this.state.fileDescription.ext.toLowerCase()
              ];
              if (!fileMode) {
                fileMode = null;
              }

              fileComponent = (
                <CodeMirror
                  value={this.state.fileDescription.content}
                  options={{
                    mode: fileMode,
                    theme: "jupyter",
                    lineNumbers: true,
                    readOnly: true,
                  }}
                />
              );
            } else if (this.state.fileDescription.ext == "ipynb") {
              fileComponent = (
                <iframe
                  ref={this.refManager.nrefs.htmlNotebookIframe}
                  className={"notebook-iframe borderless fullsize"}
                  srcDoc={this.state.fileDescription.content}
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
                    Step: {this.state.fileDescription.step_title} (
                    {this.state.fileDescription.filename})
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
              </Fragment>
            );
          }
        })()}
      </div>
    );
  }
}

export default FilePreviewView;
