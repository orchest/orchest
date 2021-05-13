// @ts-check
import React from "react";
import { MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  PromiseManager,
  makeCancelable,
  makeRequest,
  uuidv4,
  collapseDoubleDots,
} from "@orchest/lib-utils";
import { useInterval } from "@/hooks/use-interval";
import { useOrchest } from "@/hooks/orchest";
import { checkGate } from "../utils/webserver-utils";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import PipelinesView from "./PipelinesView";

const JupyterLabView = (props) => {
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

  const orchest = window.orchest;

  const promiseManager = new PromiseManager();

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
      setVerifyKernelsInterval(null);
      dispatch({ type: "clearView" });
    };
  }, []);

  React.useEffect(() => {
    const session = get.currentSession;

    if (!session) return;

    if (!session.status || session.status === "STOPPED") {
      // Schedule as callback to avoid calling setState
      // from within React render call.
      setTimeout(() => {
        dispatch({ type: "sessionToggle", payload: session });
      }, 1);
    }

    if (session?.status === "STOPPING") {
      orchest.loadView(PipelinesView);
    }

    updateJupyterInstance();
    conditionalRenderingOfJupyterLab();
  }, [state]);

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
    if (
      get.currentSession?.status === "RUNNING" &&
      hasEnvironmentCheckCompleted
    ) {
      orchest.jupyter.show();
    } else {
      orchest.jupyter.hide();
    }
  };

  const updateJupyterInstance = () => {
    let baseAddress =
      "//" +
      window.location.host +
      get.currentSession?.notebook_server_info?.base_url;
    orchest.jupyter.updateJupyterInstance(baseAddress);
  };

  return (
    <div className="view-page jupyter no-padding">
      {get.currentSession?.status !== "RUNNING" &&
        hasEnvironmentCheckCompleted && (
          <div className="lab-loader">
            <div>
              <h2>Setting up JupyterLab…</h2>
              <MDCLinearProgressReact />
            </div>
          </div>
        )}
    </div>
  );
};

export default JupyterLabView;
