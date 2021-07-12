import * as React from "react";
import { MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  PromiseManager,
  makeCancelable,
  makeRequest,
  uuidv4,
  collapseDoubleDots,
} from "@orchest/lib-utils";
import { useInterval } from "@/hooks/use-interval";
import { useOrchest, OrchestSessionsConsumer } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import { checkGate } from "@/utils/webserver-utils";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import PipelinesView from "@/views/PipelinesView";

const JupyterLabView: React.FC<any> = (props) => {
  const { state, dispatch, get } = useOrchest();

  const [verifyKernelsInterval, setVerifyKernelsInterval] = React.useState(
    1000
  );
  const [pipeline, setPipeline] = React.useState(null);
  const [pipelineCwd, setPipelineCwd] = React.useState(undefined);
  const [
    hasEnvironmentCheckCompleted,
    setHasEnvironmentCheckCompleted,
  ] = React.useState(false);

  const session = get.session(props.queryArgs);
  const orchest = window.orchest;
  const [promiseManager] = React.useState(new PromiseManager());

  React.useEffect(() => {
    // mount
    checkEnvironmentGate();
    dispatch({
      type: "setView",
      payload: "jupyter",
    });
    // dismount
    return () => {
      orchest.jupyter.hide();
      promiseManager.cancelCancelablePromises();
      setVerifyKernelsInterval(null);
      dispatch({ type: "clearView" });
    };
  }, []);

  // Launch the session if it doesn't exist
  React.useEffect(() => {
    if (
      !state.sessionsIsLoading &&
      (typeof session === "undefined" || !session?.status)
    ) {
      dispatch({ type: "sessionToggle", payload: props.queryArgs });
    }
  }, [session, state.sessionsIsLoading]);

  // On any session change
  React.useEffect(() => {
    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();

    if (session?.status === "STOPPING") {
      orchest.loadView(PipelinesView);
    }
  }, [session, hasEnvironmentCheckCompleted]);

  const checkEnvironmentGate = () => {
    checkGate(props.queryArgs.project_uuid)
      .then(() => {
        setHasEnvironmentCheckCompleted(true);
        conditionalRenderingOfJupyterLab();
        fetchPipeline();
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          orchest.requestBuild(
            props.queryArgs.project_uuid,
            result.data,
            "JupyterLab",
            () => {
              // force view reload
              orchest.loadView(JupyterLabView, {
                ...props,
                key: uuidv4(),
              });
            },
            () => {
              // back to pipelines view
              orchest.loadView(PipelinesView);
            }
          );
        }
      });
  };

  const verifyKernelsCallback = (pipeline) => setPipeline(pipeline);

  useInterval(
    () => {
      if (orchest.jupyter.isJupyterLoaded()) {
        for (let stepUUID in pipeline.steps) {
          let step = pipeline.steps[stepUUID];

          if (step.file_path.length > 0 && step.environment.length > 0) {
            orchest.jupyter.setNotebookKernel(
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
      props.queryArgs.pipeline_uuid,
      props.queryArgs.project_uuid
    );

    let fetchPipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManager
    );

    // fetch pipeline cwd
    let cwdFetchPromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/file-picker-tree/pipeline-cwd/${props.queryArgs.project_uuid}/${props.queryArgs.pipeline_uuid}`
      ),
      promiseManager
    );

    Promise.all(
      // @ts-ignore
      [cwdFetchPromise.promise, fetchPipelinePromise.promise]
    ).then(([fetchCwdResult, fetchPipelinePromiseResult]) => {
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
            pipeline_uuid: props.queryArgs.pipeline_uuid,
            project_uuid: props.queryArgs.project_uuid,
            pipelineName: pipeline.name,
          },
        });
      } else {
        console.error("Could not load pipeline.json");
        console.error(result);
      }
    });
  };

  const conditionalRenderingOfJupyterLab = () => {
    if (session?.status === "RUNNING" && hasEnvironmentCheckCompleted) {
      orchest.jupyter.show();
    } else {
      orchest.jupyter.hide();
    }
  };

  const updateJupyterInstance = () => {
    if (session?.notebook_server_info) {
      let baseAddress =
        "//" + window.location.host + session.notebook_server_info?.base_url;
      orchest.jupyter.updateJupyterInstance(baseAddress);
    }
  };

  return (
    <OrchestSessionsConsumer>
      <Layout>
        <div className="view-page jupyter no-padding">
          {session?.status !== "RUNNING" && hasEnvironmentCheckCompleted && (
            <div className="lab-loader">
              <div>
                <h2>Setting up JupyterLab…</h2>
                <MDCLinearProgressReact />
              </div>
            </div>
          )}
        </div>
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default JupyterLabView;
