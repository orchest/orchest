import React from "react";
import SessionToggleButton from "../components/SessionToggleButton";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import {
  PromiseManager,
  RefManager,
  makeCancelable,
  makeRequest,
} from "../lib/utils/all";

import { getPipelineJSONEndpoint } from "../utils/webserver-utils";

class JupyterLabView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      backend: {
        working: false,
        running: false,
      },
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentDidMount() {
    this.fetchPipeline();
  }

  componentWillUnmount() {
    $(orchest.reactRoot).removeClass("hidden");
    orchest.jupyter.hide();
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

  onSessionFetch(session_details) {
    if (session_details === undefined) {
      this.refManager.refs.sessionToggleButton.toggleSession();
    }
  }

  onSessionShutdown() {
    // restart session - this view always attempts
    // to start the session
    this.refManager.refs.sessionToggleButton.toggleSession();
  }

  render() {
    if (this.state.backend.running) {
      orchest.jupyter.show();
      $(orchest.reactRoot).addClass("hidden");
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
            onSessionFetch={this.onSessionFetch.bind(this)}
            onSessionShutdown={this.onSessionShutdown.bind(this)}
          />
        </div>
        {!this.state.backend.running && (
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
