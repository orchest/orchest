import React from "react";
import SessionToggleButton from "../components/SessionToggleButton";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import {
  PromiseManager,
  RefManager,
  makeCancelable,
  makeRequest,
  uuidv4,
} from "../lib/utils/all";

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
        this.setState({
          environmentCheckCompleted: true,
        });
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
    $(orchest.reactRoot).removeClass("hidden");
    orchest.jupyter.hide();

    clearInterval(this.verifyKernelsRetryInterval);
  }

  verifyKernelsCallback(pipeline) {
    this.verifyKernelsRetryInterval = setInterval(() => {
      if (orchest.jupyter.isJupyterLoaded()) {
        for (let stepUUID in pipeline.steps) {
          let step = pipeline.steps[stepUUID];

          if (step.file_path.length > 0 && step.environment.length > 0) {
            orchest.jupyter.setNotebookKernel(
              step.file_path,
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

    fetchPipelinePromise.promise
      .then((response) => {
        let result = JSON.parse(response);
        if (result.success) {
          let pipeline = JSON.parse(result.pipeline_json);

          this.verifyKernelsCallback(pipeline);

          orchest.headerBarComponent.setPipeline(
            this.props.queryArgs.pipeline_uuid,
            this.props.queryArgs.project_uuid,
            pipeline.name
          );

          orchest.headerBarComponent.updateCurrentView("jupyter");

          // start session if session is not running
          if (!this.state.backend.running) {
            this.refManager.refs.sessionToggleButton.toggleSession();
          }
        } else {
          console.error("Could not load pipeline.json");
          console.error(result);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  onSessionStateChange(working, running, session_details) {
    this.state.backend.working = working;
    this.state.backend.running = running;

    if (session_details) {
      this.state.backend.notebook_server_info =
        session_details.notebook_server_info;
    }

    this.setState({
      backend: this.state.backend,
    });

    if (session_details) {
      this.updateJupyterInstance();
    }

    orchest.headerBarComponent.updateSessionState(running);
  }

  updateJupyterInstance() {
    let baseAddress =
      "//" +
      window.location.host +
      this.state.backend.notebook_server_info.base_url;
    orchest.jupyter.updateJupyterInstance(baseAddress);
  }

  onSessionShutdown() {
    // restart session - this view always attempts
    // to start the session
    this.refManager.refs.sessionToggleButton.toggleSession();
  }

  render() {
    if (this.state.backend.running && this.state.environmentCheckCompleted) {
      $(orchest.reactRoot).addClass("hidden");
      orchest.jupyter.show();
    } else {
      orchest.jupyter.hide();
      $(orchest.reactRoot).removeClass("hidden");
    }

    return (
      <div className="view-page jupyter no-padding">
        <div className="hiddenSession">
          <SessionToggleButton
            ref={this.refManager.nrefs.sessionToggleButton}
            pipeline_uuid={this.props.queryArgs.pipeline_uuid}
            project_uuid={this.props.queryArgs.project_uuid}
            onSessionStateChange={this.onSessionStateChange.bind(this)}
            onSessionShutdown={this.onSessionShutdown.bind(this)}
          />
        </div>
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
