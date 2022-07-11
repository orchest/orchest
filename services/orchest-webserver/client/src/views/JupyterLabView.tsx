import { BUILD_IMAGE_SOLUTION_VIEW } from "@/components/BuildPendingDialog";
import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useInterval } from "@/hooks/use-interval";
import {
  useCancelableFetch,
  useCancelablePromise,
} from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEnsureValidPipeline } from "@/hooks/useEnsureValidPipeline";
import { fetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type {
  Pipeline,
  PipelineJson,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { joinRelativePaths } from "@orchest/lib-utils";
import React from "react";

export type IJupyterLabViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const JupyterLabView: React.FC = () => {
  // global states
  useSendAnalyticEvent("view:loaded", { name: siteMap.jupyterLab.path });
  const { makeCancelable } = useCancelablePromise();
  const { cancelableFetch } = useCancelableFetch();
  useEnsureValidPipeline();

  // data from route
  const { navigateTo, projectUuid, pipelineUuid, filePath } = useCustomRoute();

  const { getSession, toggleSession, state } = useSessionsContext();

  // local states
  const [verifyKernelsInterval, setVerifyKernelsInterval] = React.useState<
    number | undefined
  >(1000);
  const [pipelineJson, setPipelineJson] = React.useState<PipelineJson>();
  const [pipelineCwd, setPipelineCwd] = React.useState<string>();
  const [
    hasEnvironmentCheckCompleted,
    setHasEnvironmentCheckCompleted,
  ] = React.useState(false);

  const session = React.useMemo(
    () =>
      getSession({
        pipelineUuid,
        projectUuid,
      }),
    [pipelineUuid, projectUuid, getSession]
  );

  React.useEffect(() => {
    return () => {
      if (window.orchest.jupyter) {
        window.orchest.jupyter?.hide();
      }

      setVerifyKernelsInterval(undefined);
    };
  }, []);

  const fetchPipeline = React.useCallback(async () => {
    if (!pipelineUuid || !projectUuid) return;

    try {
      const [fetchedPipelineJson, pipeline] = await Promise.all([
        makeCancelable(fetchPipelineJson({ pipelineUuid, projectUuid })),
        cancelableFetch<Pipeline>(
          `/async/pipelines/${projectUuid}/${pipelineUuid}`
        ),
      ]);

      setPipelineJson(fetchedPipelineJson);
      setPipelineCwd(pipeline.path.replace(/\/?[^\/]*.orchest$/, "/"));
    } catch (error) {
      console.error("Could not load pipeline.json");
      console.error(error);
    }
  }, [cancelableFetch, makeCancelable, pipelineUuid, projectUuid]);

  const conditionalRenderingOfJupyterLab = React.useCallback(() => {
    if (window.orchest.jupyter) {
      if (session?.status === "RUNNING" && hasEnvironmentCheckCompleted) {
        if (!window.orchest.jupyter?.isShowing()) {
          window.orchest.jupyter?.show();
          if (filePath) window.orchest.jupyter?.navigateTo(filePath);
        }
      } else {
        window.orchest.jupyter?.hide();
      }
    }
  }, [filePath, hasEnvironmentCheckCompleted, session?.status]);

  const updateJupyterInstance = React.useCallback(() => {
    if (session?.base_url) {
      let baseAddress = "//" + window.location.host + session.base_url;
      window.orchest.jupyter?.updateJupyterInstance(baseAddress);
    }
  }, [session?.base_url]);

  // Launch the session if it doesn't exist
  React.useEffect(() => {
    if (!state.sessionsIsLoading && pipelineUuid && projectUuid) {
      toggleSession({
        pipelineUuid,
        projectUuid,
        requestedFromView: BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB,
        shouldStart: true,
        onBuildComplete: () => {
          // Force reloading the view.
          navigateTo(siteMap.jupyterLab.path, {
            query: { projectUuid, pipelineUuid },
          });
        },
        onCancelBuild: () => {
          // If user decides to cancel building the image, navigate back to Pipeline Editor.
          navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
        },
      }).then(() => {
        setHasEnvironmentCheckCompleted(true);
      });
    }
  }, [
    toggleSession,
    state.sessionsIsLoading,
    pipelineUuid,
    projectUuid,
    navigateTo,
  ]);

  React.useEffect(() => {
    if (session?.status === "RUNNING" && hasEnvironmentCheckCompleted) {
      conditionalRenderingOfJupyterLab();
      fetchPipeline();
    }
  }, [
    session?.status,
    hasEnvironmentCheckCompleted,
    conditionalRenderingOfJupyterLab,
    fetchPipeline,
  ]);

  // On any session change

  React.useEffect(() => {
    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();

    if (session?.status === "STOPPING") {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid },
      });
    }
  }, [
    session?.status,
    conditionalRenderingOfJupyterLab,
    navigateTo,
    projectUuid,
    updateJupyterInstance,
    hasEnvironmentCheckCompleted,
  ]);

  useInterval(
    () => {
      if (window.orchest.jupyter?.isJupyterLoaded() && pipelineJson) {
        for (let stepUUID in pipelineJson.steps) {
          let step = pipelineJson.steps[stepUUID];

          if (
            pipelineCwd &&
            step.file_path.length > 0 &&
            step.environment.length > 0
          ) {
            window.orchest.jupyter?.setNotebookKernel(
              joinRelativePaths(pipelineCwd, step.file_path),
              `orchest-kernel-${step.environment}`
            );
          }
        }

        setVerifyKernelsInterval(undefined);
      }
    },
    pipelineJson ? verifyKernelsInterval : undefined
  );

  return (
    <Layout disablePadding>
      <ProjectBasedView
        sx={{ padding: (theme) => theme.spacing(4), height: "100%" }}
      >
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
      </ProjectBasedView>
    </Layout>
  );
};

export default JupyterLabView;
