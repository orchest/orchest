import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { IconButton } from "@/components/common/IconButton";
import { PageTitle } from "@/components/common/PageTitle";
import { Layout } from "@/components/Layout";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import {
  useCancelableFetch,
  useCancelablePromise,
} from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { JobData, StepData } from "@/types";
import {
  getPipelineStepChildren,
  getPipelineStepParents,
  setWithRetry,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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

const FilePreviewView = () => {
  const { setAlert } = useGlobalContext();
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
    parentSteps: [] as StepData[],
    childSteps: [] as StepData[],
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

  const [fetchPipelineJson, fetchSnapshot] = usePipelinesApi((state) => [
    state.fetchPipelineJson,
    state.fetchSnapshot,
  ]);

  const fetchPipeline = React.useCallback(async () => {
    if (!projectUuid || !pipelineUuid) return;
    setState((prevState) => ({
      ...prevState,
      loadingFile: true,
    }));

    const [pipelineJson, job] = await Promise.all([
      makeCancelable(
        jobUuid && runUuid
          ? fetchSnapshot(projectUuid, pipelineUuid, jobUuid, runUuid)
          : fetchPipelineJson(projectUuid, pipelineUuid)
      ),
      jobUuid
        ? cancelableFetch<JobData>(`/catch/api-proxy/api/jobs/${jobUuid}`)
        : null,
    ]);

    if (!pipelineJson) return;

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
    jobUuid,
    makeCancelable,
    pipelineUuid,
    projectUuid,
    projectsState?.pipeline?.path,
    runUuid,
    stepUuid,
    fetchPipelineJson,
    fetchSnapshot,
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
        state.fileDescription?.ext === "ipynb" &&
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
    state.fileDescription?.ext,
  ]);

  const loadFile = React.useCallback(() => {
    // cache scroll position
    let attemptRestore = false;

    if (state.fileDescription) {
      // File was loaded before, requires restoring scroll position.
      attemptRestore = true;
      setCachedScrollPosition(0);
      if (
        state.fileDescription?.ext === "ipynb" &&
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
  }, []);

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

  const renderNavStep = (steps: readonly StepData[]) =>
    steps.map((step) => (
      <Link
        fontSize="16px"
        fontWeight="medium"
        style={{ cursor: "pointer" }}
        key={step.uuid}
        onClick={(event) => stepNavigate(event, step.uuid)}
        underline="hover"
      >
        {step.title}
      </Link>
    ));

  return (
    <Layout>
      <Stack height="100%">
        {state.loadingFile ? (
          <LinearProgress />
        ) : (
          <>
            <Stack>
              <Stack direction="row" alignItems="start">
                <PageTitle>
                  Step: {state.fileDescription.step_title} (
                  {state.fileDescription.filename})
                </PageTitle>
                <IconButton
                  title="refresh"
                  onClick={loadFile}
                  style={{ marginLeft: "auto" }}
                >
                  <RefreshIcon />
                </IconButton>
                <IconButton
                  title="Close"
                  onClick={loadPipelineView}
                  onAuxClick={loadPipelineView}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Stack>
                  {Boolean(state.parentSteps?.length) && (
                    <Typography
                      component="div"
                      variant="subtitle2"
                      fontSize="14px"
                      color="text.secondary"
                    >
                      Incoming connections
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2}>
                    {renderNavStep(state.parentSteps)}
                  </Stack>
                </Stack>
                <Stack alignItems="flex-end">
                  {Boolean(state.childSteps?.length) && (
                    <Typography
                      component="div"
                      variant="subtitle2"
                      fontSize="14px"
                      color="text.secondary"
                    >
                      Outgoing connections
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2}>
                    {renderNavStep(state.childSteps)}
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
            <Stack height="100%">
              {state.fileDescription && state.fileDescription.ext !== "ipynb" && (
                <CodeMirror
                  value={state.fileDescription.content}
                  onBeforeChange={() => undefined}
                  options={{
                    mode:
                      MODE_MAPPING[state.fileDescription?.ext.toLowerCase()] ||
                      null,
                    theme: "jupyter",
                    lineNumbers: true,
                    readOnly: true,
                  }}
                />
              )}
              {state.fileDescription?.ext === "ipynb" && (
                <iframe
                  height="100%"
                  ref={htmlNotebookIframeRef}
                  className="notebook-iframe borderless fullsize"
                  srcDoc={state.fileDescription.content}
                ></iframe>
              )}
              {!state.fileDescription && (
                <>
                  Something went wrong loading the file. Please try again by
                  reloading the page.
                </>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Layout>
  );
};

export default FilePreviewView;
