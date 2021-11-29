import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useInterval } from "@/hooks/use-interval";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/Routes";
import type { TViewPropsWithRequiredQueryArgs } from "@/types";
import { checkGate, getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import LinearProgress from "@mui/material/LinearProgress";
import {
  collapseDoubleDots,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";

export type IJupyterLabViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const JupyterLabView: React.FC = () => {
  // global states
  const { dispatch } = useProjectsContext();
  const { requestBuild } = useAppContext();
  const sessionsContext = useSessionsContext();
  const { getSession } = sessionsContext;
  useSessionsPoller();
  useSendAnalyticEvent("view load", { name: siteMap.jupyterLab.path });

  // data from route
  const { navigateTo, projectUuid, pipelineUuid } = useCustomRoute();

  // local states
  const [verifyKernelsInterval, setVerifyKernelsInterval] = React.useState(
    1000
  );
  const [pipeline, setPipeline] = React.useState(null);
  const [pipelineCwd, setPipelineCwd] = React.useState(undefined);
  const [
    hasEnvironmentCheckCompleted,
    setHasEnvironmentCheckCompleted,
  ] = React.useState(false);

  const session = getSession({
    pipelineUuid,
    projectUuid,
  });
  const [promiseManager] = React.useState(new PromiseManager());

  React.useEffect(() => {
    // mount
    checkEnvironmentGate();
    // unmount
    return () => {
      if (window.orchest.jupyter) {
        window.orchest.jupyter.hide();
      }
      promiseManager.cancelCancelablePromises();
      setVerifyKernelsInterval(null);
    };
  }, []);

  // Launch the session if it doesn't exist
  React.useEffect(() => {
    if (
      !sessionsContext.state.sessionsIsLoading &&
      (typeof session === "undefined" || !session?.status)
    ) {
      sessionsContext.dispatch({
        type: "sessionToggle",
        payload: { pipelineUuid, projectUuid },
      });
    }
  }, [session, sessionsContext.state.sessionsIsLoading]);

  // On any session change
  React.useEffect(() => {
    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();

    if (session?.status === "STOPPING") {
      navigateTo(siteMap.pipelines.path, {
        query: { projectUuid },
      });
    }
  }, [session, hasEnvironmentCheckCompleted]);

  const checkEnvironmentGate = () => {
    let gateCancelablePromise = makeCancelable(
      checkGate(projectUuid),
      promiseManager
    );

    gateCancelablePromise.promise
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
              navigateTo(siteMap.pipelines.path, {
                query: { projectUuid },
              });
            }
          );
        }
      });
  };

  const verifyKernelsCallback = (pipeline) => setPipeline(pipeline);

  useInterval(
    () => {
      if (window.orchest.jupyter.isJupyterLoaded()) {
        for (let stepUUID in pipeline.steps) {
          let step = pipeline.steps[stepUUID];

          if (step.file_path.length > 0 && step.environment.length > 0) {
            window.orchest.jupyter.setNotebookKernel(
              collapseDoubleDots(pipelineCwd + step.file_path).slice(1),
              `orchest-kernel-${step.environment}`
            );
          }
        }

        setVerifyKernelsInterval(null);
      }
    },
    pipeline ? verifyKernelsInterval : null
  );

  const fetchPipeline = () => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      pipelineUuid,
      projectUuid
    );

    let fetchPipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManager
    );

    // fetch pipeline cwd
    let cwdFetchPromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/file-picker-tree/pipeline-cwd/${projectUuid}/${pipelineUuid}`
      ),
      promiseManager
    );

    Promise.all([cwdFetchPromise.promise, fetchPipelinePromise.promise]).then(
      ([fetchCwdResult, fetchPipelinePromiseResult]) => {
        // relativeToAbsolutePath expects trailing / for directories
        let cwd = JSON.parse(fetchCwdResult)["cwd"] + "/";
        setPipelineCwd(cwd);

        let result = JSON.parse(fetchPipelinePromiseResult);
        if (result.success) {
          let pipeline = JSON.parse(result.pipeline_json);
          verifyKernelsCallback(pipeline);

          dispatch({
            type: "pipelineSet",
            payload: {
              pipelineUuid,
              projectUuid,
              pipelineName: pipeline.name,
            },
          });
        } else {
          console.error("Could not load pipeline.json");
          console.error(result);
        }
      }
    );
  };

  const conditionalRenderingOfJupyterLab = () => {
    if (window.orchest.jupyter) {
      if (session?.status === "RUNNING" && hasEnvironmentCheckCompleted) {
        window.orchest.jupyter.show();
      } else {
        window.orchest.jupyter.hide();
      }
    }
  };

  const updateJupyterInstance = () => {
    if (session?.notebook_server_info) {
      let baseAddress =
        "//" + window.location.host + session.notebook_server_info?.base_url;
      window.orchest.jupyter.updateJupyterInstance(baseAddress);
    }
  };

  return (
    <Layout>
      <div className="view-page jupyter no-padding">
        <div className="lab-loader">
          <div>
            <h2>Setting up JupyterLab…</h2>
            <LinearProgress />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default JupyterLabView;
