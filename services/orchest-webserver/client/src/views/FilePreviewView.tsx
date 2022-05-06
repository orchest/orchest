import { IconButton } from "@/components/common/IconButton";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import {
  useCancelableFetch,
  useCancelablePromise,
} from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { Job } from "@/types";
import {
  getPipelineJSONEndpoint,
  getPipelineStepChildren,
  getPipelineStepParents,
  setWithRetry,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { hasValue, RefManager } from "@orchest/lib-utils";
import "codemirror/mode/python/python";
import "codemirror/mode/r/r";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

const MODE_MAPPING = {
  py: "text/x-python",
  sh: "text/x-sh",
  r: "text/x-rsrc",
} as const;

const FilePreviewView: React.FC = () => {
  // global states
  const { setAlert } = useAppContext();
  const { state: projectsState, dispatch } = useProjectsContext();
  useSendAnalyticEvent("view load", { name: siteMap.filePreview.path });
  const { cancelableFetch } = useCancelableFetch();
  const { makeCancelable } = useCancelablePromise();

  // data from route
  const {
    navigateTo,
    projectUuid,
    pipelineUuid,
    stepUuid,
    jobUuid,
    runUuid,
    isReadOnly: isReadOnlyFromQueryString,
  } = useCustomRoute();

  const isJobRun = hasValue(jobUuid && runUuid);
  const isReadOnly = isJobRun || isReadOnlyFromQueryString;

  // local states
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

  const loadPipelineView = (e: React.MouseEvent) => {
    const isJobRun = jobUuid && runUuid;

    navigateTo(
      isJobRun ? siteMap.jobRun.path : siteMap.pipeline.path,
      {
        query: { projectUuid, pipelineUuid, jobUuid, runUuid },
        state: { isReadOnly },
      },
      e
    );
  };

  const fetchPipeline = async () => {
    if (!pipelineUuid) return;
    setState((prevState) => ({
      ...prevState,
      loadingFile: true,
    }));

    let pipelineURL = isJobRun
      ? getPipelineJSONEndpoint({ pipelineUuid, projectUuid, jobUuid, runUuid })
      : getPipelineJSONEndpoint({ pipelineUuid, projectUuid });

    const [pipelineJson, job] = await Promise.all([
      makeCancelable(fetchPipelineJson(pipelineURL)),
      jobUuid
        ? cancelableFetch<Job>(`/catch/api-proxy/api/jobs/${jobUuid}`)
        : null,
    ]);

    const pipelineFilePath =
      job?.pipeline_run_spec.run_config.pipeline_path ||
      projectsState?.pipeline?.path;

    dispatch({
      type: "UPDATE_PIPELINE",
      payload: { uuid: pipelineUuid, path: pipelineFilePath },
    });

    setState((prevState) => ({
      ...prevState,
      parentSteps: getPipelineStepParents(stepUuid, pipelineJson),
      childSteps: getPipelineStepChildren(stepUuid, pipelineJson),
    }));
  };

  const fetchAll = () =>
    new Promise((resolve, reject) => {
      setState((prevState) => ({
        ...prevState,
        loadingFile: true,
      }));

      Promise.all([fetchFile(), fetchPipeline()])
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

  const fetchFile = () => {
    let fileURL = `/async/file-viewer/${projectUuid}/${pipelineUuid}/${stepUuid}`;
    if (isJobRun) {
      fileURL += "?pipeline_run_uuid=" + runUuid;
      fileURL += "&job_uuid=" + jobUuid;
    }

    return cancelableFetch(fileURL).then((response) => {
      setState((prevState) => ({
        ...prevState,
        fileDescription: response,
      }));
    });
  };

  const stepNavigate = (e: React.MouseEvent, newStepUuid: string) => {
    navigateTo(
      siteMap.filePreview.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          stepUuid: newStepUuid,
          jobUuid,
          runUuid,
        },
      },
      e
    );
  };

  const renderNavStep = (steps) => {
    return steps.map((step) => (
      <Button
        variant="text"
        key={step.uuid}
        onClick={(e) => stepNavigate(e, step.uuid)}
        onAuxClick={(e) => stepNavigate(e, step.uuid)}
      >
        {step.title}
      </Button>
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
        setAlert(
          "Error",
          "Failed to load file. Make sure the path of the pipeline step is correct."
        );
      });
  };

  React.useEffect(() => {
    loadFile();

    return () => {
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
  }, [stepUuid, pipelineUuid]);

  let parentStepElements = renderNavStep(state.parentSteps);
  let childStepElements = renderNavStep(state.childSteps);

  return (
    <Layout>
      <div
        className={"view-page file-viewer no-padding fullheight relative"}
        ref={refManager.nrefs.fileViewer}
      >
        <div className="top-buttons">
          <IconButton title="refresh" onClick={loadFile}>
            <RefreshIcon />
          </IconButton>
          <IconButton
            title="Close"
            onClick={loadPipelineView}
            onAuxClick={loadPipelineView}
          >
            <CloseIcon />
          </IconButton>
        </div>

        {(() => {
          if (state.loadingFile) {
            return <LinearProgress />;
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
                <CodeMirror
                  value={state.fileDescription.content}
                  onBeforeChange={undefined}
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
