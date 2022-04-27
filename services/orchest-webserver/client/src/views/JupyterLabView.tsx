import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
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
import { siteMap } from "@/Routes";
import type {
  Pipeline,
  PipelineJson,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import { checkGate } from "@/utils/webserver-utils";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { collapseDoubleDots } from "@orchest/lib-utils";
import React from "react";

export type IJupyterLabViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const JupyterLabView: React.FC = () => {
  // global states
  const { requestBuild } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.jupyterLab.path });
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
    // mount
    checkEnvironmentGate();
    // unmount
    return () => {
      if (window.orchest.jupyter) {
        window.orchest.jupyter.hide();
      }

      setVerifyKernelsInterval(undefined);
    };
  }, []);

  // Launch the session if it doesn't exist
  React.useEffect(() => {
    if (!state.sessionsIsLoading && !session && pipelineUuid && projectUuid) {
      toggleSession({ pipelineUuid, projectUuid });
    }
  }, [session, toggleSession, state, pipelineUuid, projectUuid]);

  // On any session change
  React.useEffect(() => {
    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();

    if (session?.status === "STOPPING") {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid },
      });
    }
  }, [session, hasEnvironmentCheckCompleted]);

  const checkEnvironmentGate = () => {
    makeCancelable(checkGate(projectUuid))
      .then(() => {
        setHasEnvironmentCheckCompleted(true);
        conditionalRenderingOfJupyterLab();
        fetchPipeline();
      })
      .catch((result) => {
        if (result.isCanceled) {
          // Do nothing when the promise is canceled
          return;
        }
        if (result.reason === "gate-failed") {
          requestBuild(
            projectUuid,
            result.data,
            "JupyterLab",
            () => {
              // force view reload
              navigateTo(siteMap.jupyterLab.path, {
                query: { projectUuid, pipelineUuid },
              });
            },
            () => {
              // back to pipelines view
              navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
            }
          );
        }
      });
  };

  useInterval(
    () => {
      if (window.orchest.jupyter.isJupyterLoaded() && pipelineJson) {
        for (let stepUUID in pipelineJson.steps) {
          let step = pipelineJson.steps[stepUUID];

          if (step.file_path.length > 0 && step.environment.length > 0) {
            window.orchest.jupyter.setNotebookKernel(
              collapseDoubleDots(pipelineCwd + step.file_path).slice(1),
              `orchest-kernel-${step.environment}`
            );
          }
        }

        setVerifyKernelsInterval(undefined);
      }
    },
    pipelineJson ? verifyKernelsInterval : undefined
  );

  const fetchPipeline = async () => {
    if (!pipelineUuid || !projectUuid) return;

    try {
      const [fetchedPipelineJson, pipeline] = await Promise.all([
        makeCancelable(fetchPipelineJson({ pipelineUuid, projectUuid })),
        cancelableFetch<Pipeline>(`/async/pipelines/${projectUuid}/${pipelineUuid}`),
      ]);

      setPipelineJson(fetchedPipelineJson);
      setPipelineCwd(pipeline.path.replace(/\/?[^\/]*.orchest$/, "/"));
    } catch (error) {
      console.error("Could not load pipeline.json");
      console.error(error);
    }
  };

  const conditionalRenderingOfJupyterLab = () => {
    if (window.orchest.jupyter) {
      if (session?.status === "RUNNING" && hasEnvironmentCheckCompleted) {
        window.setTimeout(() => {
          window.orchest.jupyter.show();
          if (filePath) window.orchest.jupyter.navigateTo(filePath);
        }, 2000); // If set to smaller, it gets 503 Temorarily unavailable and get stuck.
      } else {
        window.orchest.jupyter.hide();
      }
    }
  };

  const updateJupyterInstance = () => {
    if (session?.base_url) {
      let baseAddress = "//" + window.location.host + session.base_url;
      window.orchest.jupyter.updateJupyterInstance(baseAddress);
    }
  };

  return (
    <Layout disablePadding>
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
    </Layout>
  );
};

export default JupyterLabView;
