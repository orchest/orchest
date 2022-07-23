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
import { Job, Step } from "@/types";
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
import { hasValue } from "@orchest/lib-utils";
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
  const { setAlert } = useAppContext();
  const { state: projectsState, dispatch } = useProjectsContext();
  const { cancelableFetch } = useCancelableFetch();
  const { makeCancelable } = useCancelablePromise();

  useSendAnalyticEvent("view:loaded", { name: siteMap.filePreview.path });

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

  const [state, setState] = React.useState({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notebookHtml: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileDescription: undefined as any,
    loadingFile: true,
    parentSteps: [] as Step[],
    childSteps: [] as Step[],
  });

  const [cachedScrollPosition, setCachedScrollPosition] = React.useState<
    number
  >();
  const [
    isRestoringScrollPosition,
    setIsRestoringScrollPosition,
  ] = React.useState(false);
  const [retryIntervals, setRetryIntervals] = React.useState<
    (number | undefined)[]
  >([]);

  const htmlNotebookIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const fileViewerRef = React.useRef<HTMLDivElement | null>(null);

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

  const fetchPipeline = React.useCallback(async () => {
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

    setState((prevState) =>
      stepUuid
        ? {
            ...prevState,
            parentSteps: getPipelineStepParents(stepUuid, pipelineJson),
            childSteps: getPipelineStepChildren(stepUuid, pipelineJson),
          }
        : prevState
    );
  }, [
    cancelableFetch,
    dispatch,
    isJobRun,
    jobUuid,
    makeCancelable,
    pipelineUuid,
    projectUuid,
    projectsState?.pipeline?.path,
    runUuid,
    stepUuid,
  ]);

  const fetchFile = React.useCallback(() => {
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
  }, [
    cancelableFetch,
    isJobRun,
    jobUuid,
    pipelineUuid,
    projectUuid,
    runUuid,
    stepUuid,
  ]);

  const stepNavigate = React.useCallback(
    (event: React.MouseEvent, newStepUuid: string) => {
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
        event
      );
    },
    [jobUuid, navigateTo, pipelineUuid, projectUuid, runUuid]
  );

  const fetchAll = React.useCallback(
    () =>
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
      }),
    [fetchFile, fetchPipeline]
  );

  React.useEffect(() => {
    if (isRestoringScrollPosition) {
      setIsRestoringScrollPosition(false);

      if (
        state.fileDescription.ext === "ipynb" &&
        htmlNotebookIframeRef.current
      ) {
        setRetryIntervals((prevRetryIntervals) => [
          ...prevRetryIntervals,
          setWithRetry(
            cachedScrollPosition,
            (value) => {
              if (!value) return;
              htmlNotebookIframeRef.current?.contentWindow?.scrollTo(
                htmlNotebookIframeRef.current.contentWindow.scrollX,
                value
              );
            },
            () => htmlNotebookIframeRef.current?.contentWindow?.scrollY,
            25,
            100
          ),
        ]);
      } else if (fileViewerRef.current) {
        setRetryIntervals((prevRetryIntervals) => [
          ...prevRetryIntervals,
          setWithRetry(
            cachedScrollPosition,
            (value) => {
              if (!fileViewerRef.current || !value) return;
              fileViewerRef.current.scrollTop = value;
            },
            () => {
              return fileViewerRef.current?.scrollTop;
            },
            25,
            100
          ),
        ]);
      }
    }
  }, [
    cachedScrollPosition,
    isRestoringScrollPosition,
    state.fileDescription.ext,
  ]);

  const loadFile = React.useCallback(() => {
    // cache scroll position
    let attemptRestore = false;

    if (state.fileDescription) {
      // File was loaded before, requires restoring scroll position.
      attemptRestore = true;
      setCachedScrollPosition(0);
      if (
        state.fileDescription.ext === "ipynb" &&
        htmlNotebookIframeRef.current
      ) {
        setCachedScrollPosition(
          htmlNotebookIframeRef.current?.contentWindow?.scrollY
        );
      } else if (fileViewerRef.current) {
        setCachedScrollPosition(fileViewerRef.current?.scrollTop);
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
  }, [fetchAll, setAlert, state.fileDescription]);

  React.useEffect(() => {
    loadFile();

    return () => {
      retryIntervals.map((retryInterval) => clearInterval(retryInterval));
    };
  }, [loadFile, retryIntervals]);

  React.useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      fileDescription: "",
      notebookHtml: "",
    }));
    loadFile();
  }, [stepUuid, pipelineUuid, loadFile]);

  const renderNavStep = (steps: readonly Step[]) =>
    steps.map((step) => (
      <Button
        variant="text"
        key={step.uuid}
        onClick={(event) => stepNavigate(event, step.uuid)}
        onAuxClick={(event) => stepNavigate(event, step.uuid)}
      >
        {step.title}
      </Button>
    ));

  const parentStepElements = renderNavStep(state.parentSteps);
  const childStepElements = renderNavStep(state.childSteps);

  return (
    <Layout>
      <div
        className="view-page file-viewer no-padding full height relative"
        ref={fileViewerRef}
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
          } else if (state.fileDescription && state.parentSteps) {
            let fileComponent: React.ReactNode;

            if (state.fileDescription.ext !== "ipynb") {
              const fileMode =
                MODE_MAPPING[state.fileDescription.ext.toLowerCase()] || null;

              fileComponent = (
                <CodeMirror
                  value={state.fileDescription.content}
                  onBeforeChange={() => undefined}
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
                  ref={htmlNotebookIframeRef}
                  className="notebook-iframe borderless fullsize"
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
