import * as React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/python/python";
import "codemirror/mode/shell/shell";
import "codemirror/mode/r/r";

import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  makeRequest,
  PromiseManager,
  RefManager,
  makeCancelable,
} from "@orchest/lib-utils";

import { Layout } from "@/components/Layout";
import {
  getPipelineJSONEndpoint,
  getPipelineStepParents,
  getPipelineStepChildren,
  setWithRetry,
} from "@/utils/webserver-utils";
import PipelineView from "@/views/PipelineView";

const MODE_MAPPING = {
  py: "text/x-python",
  sh: "text/x-sh",
  r: "text/x-rsrc",
} as const;

const FilePreviewView: React.FC<any> = (props) => {
  const { orchest } = window;

  const [state, setState] = React.useState({
    notebookHtml: undefined,
    fileDescription: undefined,
    loadingFile: true,
    parentSteps: [],
    childSteps: [],
  });

  const [cachedScrollPosition, setCachedScrollPosition] = React.useState(
    undefined
  );
  const [
    isRestoringScrollPosition,
    setIsRestoringScrollPosition,
  ] = React.useState(false);
  const [retryIntervals, setRetryIntervals] = React.useState([]);

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());

  const loadPipelineView = () => {
    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        read_only: props.queryArgs.read_only,
        job_uuid: props.queryArgs.job_uuid,
        run_uuid: props.queryArgs.run_uuid,
      },
    });
  };

  const fetchPipeline = () =>
    new Promise((resolve, reject) => {
      setState((prevState) => ({
        ...prevState,
        loadingFile: true,
      }));

      let pipelineURL = props.queryArgs.job_uuid
        ? getPipelineJSONEndpoint(
            props.queryArgs.pipeline_uuid,
            props.queryArgs.project_uuid,
            props.queryArgs.job_uuid,
            props.queryArgs.run_uuid
          )
        : getPipelineJSONEndpoint(
            props.queryArgs.pipeline_uuid,
            props.queryArgs.project_uuid
          );

      let fetchPipelinePromise = makeCancelable(
        makeRequest("GET", pipelineURL),
        promiseManager
      );

      fetchPipelinePromise.promise
        .then((response) => {
          let pipelineJSON = JSON.parse(JSON.parse(response)["pipeline_json"]);

          setState((prevState) => ({
            ...prevState,
            parentSteps: getPipelineStepParents(
              props.queryArgs.step_uuid,
              pipelineJSON
            ),
            childSteps: getPipelineStepChildren(
              props.queryArgs.step_uuid,
              pipelineJSON
            ),
          }));

          resolve(undefined);
        })
        .catch((err) => {
          console.log(err);
          reject();
        });
    });

  const fetchAll = () =>
    new Promise((resolve, reject) => {
      setState((prevState) => ({
        ...prevState,
        loadingFile: true,
      }));

      let fetchAllPromise = makeCancelable(
        Promise.all([fetchFile(), fetchPipeline()]),
        promiseManager
      );

      fetchAllPromise.promise
        .then(() => {
          setState((prevState) => ({
            ...prevState,
            loadingFile: false,
          }));
          resolve(undefined);
        })
        .catch(() => {
          setState((prevState) => ({
            ...prevState,
            loadingFile: false,
          }));
          reject();
        });
    });

  const fetchFile = () =>
    new Promise((resolve, reject) => {
      let fileURL = `/async/file-viewer/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}/${props.queryArgs.step_uuid}`;
      if (props.queryArgs.run_uuid) {
        fileURL += "?pipeline_run_uuid=" + props.queryArgs.run_uuid;
        fileURL += "&job_uuid=" + props.queryArgs.job_uuid;
      }

      let fetchFilePromise = makeCancelable(
        makeRequest("GET", fileURL),
        promiseManager
      );

      fetchFilePromise.promise
        .then((response) => {
          setState((prevState) => ({
            ...prevState,
            fileDescription: JSON.parse(response),
          }));
          resolve(undefined);
        })
        .catch((err) => {
          console.log(err);
          reject();
        });
    });

  const stepNavigate = (stepUUID) => {
    let propClone = JSON.parse(JSON.stringify(props));
    propClone.queryArgs.step_uuid = stepUUID;

    orchest.loadView(FilePreviewView, propClone);
  };

  const renderNavStep = (steps) => {
    return steps.map((step) => (
      <button
        key={step.uuid}
        onClick={stepNavigate.bind(this, step.uuid)}
        className="text-button"
      >
        {step.title}
      </button>
    ));
  };

  React.useEffect(() => {
    if (isRestoringScrollPosition) {
      setIsRestoringScrollPosition(false);

      if (
        state.fileDescription.ext == "ipynb" &&
        refManager.refs.htmlNotebookIframe
      ) {
        setRetryIntervals((prevRetryIntervals) => [
          ...prevRetryIntervals,
          setWithRetry(
            cachedScrollPosition,
            (value) => {
              refManager.refs.htmlNotebookIframe.contentWindow.scrollTo(
                refManager.refs.htmlNotebookIframe.contentWindow.scrollX,
                value
              );
            },
            () => {
              return refManager.refs.htmlNotebookIframe.contentWindow.scrollY;
            },
            25,
            100
          ),
        ]);
      } else if (refManager.refs.fileViewer) {
        setRetryIntervals((prevRetryIntervals) => [
          ...prevRetryIntervals,
          setWithRetry(
            cachedScrollPosition,
            (value) => {
              refManager.refs.fileViewer.scrollTop = value;
            },
            () => {
              return refManager.refs.fileViewer.scrollTop;
            },
            25,
            100
          ),
        ]);
      }
    }
  }, [isRestoringScrollPosition]);

  const loadFile = () => {
    // cache scroll position
    let attemptRestore = false;

    if (state.fileDescription) {
      // File was loaded before, requires restoring scroll position.
      attemptRestore = true;
      setCachedScrollPosition(0);
      if (
        state.fileDescription.ext == "ipynb" &&
        refManager.refs.htmlNotebookIframe
      ) {
        setCachedScrollPosition(
          refManager.refs.htmlNotebookIframe.contentWindow.scrollY
        );
      } else if (refManager.refs.fileViewer) {
        setCachedScrollPosition(refManager.refs.fileViewer.scrollTop);
      }
    }

    fetchAll()
      .then(() => {
        if (attemptRestore) {
          setIsRestoringScrollPosition(true);
        }
      })
      .catch(() => {
        orchest.alert(
          "Error",
          "Failed to load file. Make sure the path of the pipeline step is correct."
        );
      });
  };

  React.useEffect(() => {
    loadFile();

    return () => {
      promiseManager.cancelCancelablePromises();

      retryIntervals.map((retryInterval) => clearInterval(retryInterval));
    };
  }, []);

  React.useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      fileDescription: undefined,
      notebookHtml: undefined,
    }));
    loadFile();
  }, [props.queryArgs.step_uuid, props.queryArgs.pipeline_uuid]);

  let parentStepElements = renderNavStep(state.parentSteps);
  let childStepElements = renderNavStep(state.childSteps);

  return (
    <Layout>
      <div
        className={"view-page file-viewer no-padding"}
        ref={refManager.nrefs.fileViewer}
      >
        <div className="top-buttons">
          <MDCButtonReact
            classNames={["refresh-button"]}
            icon="refresh"
            onClick={loadFile.bind(this)}
          />
          <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={loadPipelineView.bind(this)}
          />
        </div>

        {(() => {
          if (state.loadingFile) {
            return <MDCLinearProgressReact />;
          } else if (
            state.fileDescription != undefined &&
            state.parentSteps != undefined
          ) {
            let fileComponent;

            if (state.fileDescription.ext != "ipynb") {
              let fileMode =
                MODE_MAPPING[state.fileDescription.ext.toLowerCase()];
              if (!fileMode) {
                fileMode = null;
              }

              fileComponent = (
                // @ts-ignore
                <CodeMirror
                  value={state.fileDescription.content}
                  options={{
                    mode: fileMode,
                    theme: "jupyter",
                    lineNumbers: true,
                    readOnly: true,
                  }}
                />
              );
            } else if (state.fileDescription.ext == "ipynb") {
              fileComponent = (
                <iframe
                  ref={refManager.nrefs.htmlNotebookIframe}
                  className={"notebook-iframe borderless fullsize"}
                  srcDoc={state.fileDescription.content}
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
              <React.Fragment>
                <div className="file-description">
                  <h3>
                    Step: {state.fileDescription.step_title} (
                    {state.fileDescription.filename})
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
              </React.Fragment>
            );
          }
        })()}
      </div>
    </Layout>
  );
};

export default FilePreviewView;
