import BuildPendingDialog from "@/components/BuildPendingDialog";
import { Layout } from "@/components/layout/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useGlobalContext } from "@/contexts/GlobalContext";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import {
  useCancelableFetch,
  useCancelablePromise,
} from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEnsureValidPipeline } from "@/hooks/useEnsureValidPipeline";
import { fetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useInterval } from "@/hooks/useInterval";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type {
  PipelineData,
  PipelineJson,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import { join } from "@/utils/path";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { FetchError } from "@orchest/lib-utils";
import React from "react";

export type IJupyterLabViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const JupyterLabView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.jupyterLab.path });
  const { makeCancelable } = useCancelablePromise();
  const { cancelableFetch } = useCancelableFetch();
  useEnsureValidPipeline();
  const { dispatch } = useProjectsContext();

  const { navigateTo, projectUuid, pipelineUuid, filePath } = useCustomRoute();
  const { setAlert } = useGlobalContext();
  const {
    getSession,
    startSession,
    state: { sessions },
  } = useSessionsContext();
  const {
    state: { pipelineReadOnlyReason },
  } = useProjectsContext();

  const [verifyKernelsInterval, setVerifyKernelsInterval] = React.useState<
    number | undefined
  >(1000);
  const [pipelineJson, setPipelineJson] = React.useState<PipelineJson>();
  const [pipelineCwd, setPipelineCwd] = React.useState<string>();

  const session = React.useMemo(
    () => (pipelineReadOnlyReason ? undefined : getSession(pipelineUuid)),
    [pipelineUuid, getSession, pipelineReadOnlyReason]
  );

  React.useEffect(() => {
    return () => {
      window.orchest.jupyter?.hide();
      setVerifyKernelsInterval(undefined);
    };
  }, []);

  const fetchPipeline = React.useCallback(async () => {
    if (!pipelineUuid || !projectUuid) return;

    try {
      const [fetchedPipelineJson, pipeline] = await Promise.all([
        makeCancelable(fetchPipelineJson({ pipelineUuid, projectUuid })),
        cancelableFetch<PipelineData>(
          `/async/pipelines/${projectUuid}/${pipelineUuid}`
        ),
      ]);

      setPipelineJson(fetchedPipelineJson);
      setPipelineCwd(pipeline.path.replace(/\/?[^\/]*.orchest$/, "/"));
    } catch (error) {
      if (!error.isCanceled) {
        console.error("");
        console.error("Failed to load pipeline.json: " + String(error));
      }
    }
  }, [cancelableFetch, makeCancelable, pipelineUuid, projectUuid]);

  // Launch the session on mount.
  React.useEffect(() => {
    if (pipelineUuid && projectUuid && sessions && !session) {
      startSession(pipelineUuid, BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB)
        .then((result) => {
          if (result === true) {
            dispatch({
              type: "SET_PIPELINE_READONLY_REASON",
              payload: undefined,
            });
          } else if (shouldRedirectToPipelineEditor(result)) {
            // When failed, it could be that the pipeline does no longer exist.
            // Navigate back to PipelineEditor.
            navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
          }
        })
        .catch(() => {
          navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
        });
    }
  }, [
    sessions,
    startSession,
    pipelineUuid,
    projectUuid,
    navigateTo,
    dispatch,
    setAlert,
    session,
  ]);

  const conditionalRenderingOfJupyterLab = React.useCallback(() => {
    if (session?.status === "RUNNING") {
      if (!window.orchest.jupyter?.isShowing()) {
        window.orchest.jupyter?.show();
        if (filePath) window.orchest.jupyter?.openFile(filePath);
      }
    } else {
      window.orchest.jupyter?.hide();
    }
  }, [filePath, session?.status]);

  React.useEffect(() => {
    if (session?.status === "RUNNING") {
      conditionalRenderingOfJupyterLab();
      fetchPipeline();
    }
  }, [session?.status, conditionalRenderingOfJupyterLab, fetchPipeline]);

  // On any session change

  const updateJupyterInstance = React.useCallback(() => {
    if (session?.base_url) {
      const baseAddress = "//" + window.location.host + session.base_url;
      window.orchest.jupyter?.updateJupyterInstance(baseAddress);
    }
  }, [session?.base_url]);

  React.useEffect(() => {
    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();

    if (session?.status === "STOPPING") {
      navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
    }
  }, [
    session?.status,
    conditionalRenderingOfJupyterLab,
    navigateTo,
    projectUuid,
    updateJupyterInstance,
  ]);

  useInterval(
    () => {
      if (window.orchest.jupyter?.hasRendered() && pipelineJson) {
        for (let stepUUID in pipelineJson.steps) {
          let step = pipelineJson.steps[stepUUID];

          if (
            pipelineCwd &&
            step.file_path.length > 0 &&
            step.environment.length > 0
          ) {
            window.orchest.jupyter?.setNotebookKernel(
              join(pipelineCwd, step.file_path),
              `orchest-kernel-${step.environment}`
            );
          }
        }

        setVerifyKernelsInterval(undefined);
      }
    },
    pipelineJson ? verifyKernelsInterval : undefined
  );

  React.useEffect(() => {
    if (session?.status === "STOPPING") {
      setAlert(
        "Session stopping",
        "Your pipeline session is still stopping, " +
          "please try opening JupyterLab again once the session has stopped.",
        {
          confirmLabel: "Close",
          onConfirm: () => true,
        }
      );
      navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
    }
  }, [setAlert, navigateTo, session?.status, projectUuid]);

  return (
    <Layout disablePadding>
      <ProjectBasedView
        sx={{ padding: (theme) => theme.spacing(4), height: "100%" }}
      >
        {!window.orchest.jupyter?.hasLoaded() && (
          <Stack
            justifyContent="center"
            alignItems="center"
            sx={{ height: "100%" }}
          >
            <Box
              sx={{
                textAlign: "center",
                width: "100%",
                maxWidth: "400px",
              }}
            >
              <Typography component="h2" variant="h6" sx={{ marginBottom: 3 }}>
                Setting up JupyterLab…
              </Typography>
              <LinearProgress />
            </Box>
          </Stack>
        )}
      </ProjectBasedView>
      <BuildPendingDialog
        onCancel={() => {
          navigateTo(siteMap.pipeline.path, {
            query: { projectUuid, pipelineUuid },
          });
        }}
      />
    </Layout>
  );
};

export default JupyterLabView;

const shouldRedirectToPipelineEditor = (error: Error) => {
  if (error instanceof FetchError && error.status === 409) {
    // There can sometimes be a race-condition
    // when the session is fetched after the
    // POST request to create a new one has been fired.
    // This is fine, and we don't have to redirect back.
    return false;
  }

  switch (error.message) {
    case "environmentsNotYetBuilt":
    case "environmentsBuildInProgress":
    case "environmentsFailedToBuild":
      return false;
    default:
      return true;
  }
};
