import React from "react";
import { MDCLinearProgressReact } from "@orchest/lib-mdc";
import {
  PromiseManager,
  RefManager,
  makeCancelable,
  makeRequest,
  uuidv4,
  collapseDoubleDots,
} from "@orchest/lib-utils";
import { checkGate } from "../utils/webserver-utils";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import PipelinesView from "./PipelinesView";

class JupyterLabView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      backend: {
        working: false,
        running: false,
      },
      environmentCheckCompleted: false,
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentDidMount() {
    this.checkEnvironmentGate();
  }

  checkEnvironmentGate() {
    checkGate(this.props.queryArgs.project_uuid)
      .then(() => {
        this.state.environmentCheckCompleted = true;
        this.setState({
          environmentCheckCompleted: this.state.environmentCheckCompleted,
        });
        this.conditionalRenderingOfJupyterLab();
        this.fetchPipeline();
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          orchest.requestBuild(
            this.props.queryArgs.project_uuid,
            result.data,
            "JupyterLab",
            () => {
              // force view reload
              orchest.loadView(JupyterLabView, {
                ...this.props,
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
  }

  componentWillUnmount() {
    orchest.jupyter.hide();

    orchest.headerBarComponent.clearSessionListeners();

    clearInterval(this.verifyKernelsRetryInterval);
  }

  verifyKernelsCallback(pipeline) {
    this.verifyKernelsRetryInterval = setInterval(() => {
      if (orchest.jupyter.isJupyterLoaded()) {
        for (let stepUUID in pipeline.steps) {
          let step = pipeline.steps[stepUUID];

          if (step.file_path.length > 0 && step.environment.length > 0) {
            orchest.jupyter.setNotebookKernel(
              collapseDoubleDots(this.state.pipelineCwd + step.file_path).slice(
                1
              ),
              `orchest-kernel-${step.environment}`
            );
          }
        }

        clearInterval(this.verifyKernelsRetryInterval);
      }
    }, 1000);
  }

  fetchPipeline() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.props.queryArgs.pipeline_uuid,
      this.props.queryArgs.project_uuid
    );

    let fetchPipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      this.promiseManager
    );

    // fetch pipeline cwd
    let cwdFetchPromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/file-picker-tree/pipeline-cwd/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`
      ),
      this.promiseManager
    );

    Promise.all([cwdFetchPromise.promise, fetchPipelinePromise.promise]).then(
      ([fetchCwdResult, fetchPipelinePromiseResult]) => {
        // relativeToAbsolutePath expects trailing / for directories
        let cwd = JSON.parse(fetchCwdResult)["cwd"] + "/";
        this.state.pipelineCwd = cwd;
        this.setState({
          pipelineCwd: cwd,
        });

        let result = JSON.parse(fetchPipelinePromiseResult);
        if (result.success) {
          let pipeline = JSON.parse(result.pipeline_json);

          this.verifyKernelsCallback(pipeline);

          orchest.headerBarComponent.setSessionListeners(
            this.onSessionStateChange.bind(this)
          );

          orchest.headerBarComponent.setPipeline(
            this.props.queryArgs.pipeline_uuid,
            this.props.queryArgs.project_uuid,
            pipeline.name
          );

          orchest.headerBarComponent.updateCurrentView("jupyter");
        } else {
          console.error("Could not load pipeline.json");
          console.error(result);
        }
      }
    );
  }

  onSessionStateChange(working, running, session_details) {
    this.state.backend.working = working;
    this.state.backend.running = running;

    if (session_details) {
      this.state.backend.notebook_server_info =
        session_details.notebook_server_info;
    }

    // Start session if it's not running
    if (!working && !running) {
      // Schedule as callback to avoid calling setState
      // from within React render call.
      setTimeout(() => {
        orchest.headerBarComponent.toggleSession();
      }, 1);
    }

    this.setState({
      backend: this.state.backend,
    });

    if (session_details) {
      this.updateJupyterInstance();
    }

    this.conditionalRenderingOfJupyterLab();
  }

  conditionalRenderingOfJupyterLab() {
    if (this.state.backend.running && this.state.environmentCheckCompleted) {
      orchest.jupyter.show();
    } else {
      orchest.jupyter.hide();
    }
  }

  updateJupyterInstance() {
    let baseAddress =
      "//" +
      window.location.host +
      this.state.backend.notebook_server_info.base_url;
    orchest.jupyter.updateJupyterInstance(baseAddress);
  }

  render() {
    return (
      <div className="view-page jupyter no-padding">
        {!this.state.backend.running && this.state.environmentCheckCompleted && (
          <div className="lab-loader">
            <div>
              <h2>Setting up JupyterLab…</h2>
              <MDCLinearProgressReact />
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default JupyterLabView;
