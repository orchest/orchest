import React from "react";
import PipelineView from "./PipelineView";
import LogViewer from "../components/LogViewer";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
} from "@orchest/lib-utils";

import io from "socket.io-client";
import {
  MDCButtonReact,
  MDCLinearProgressReact,
  MDCDrawerReact,
} from "@orchest/lib-mdc";
import { OrchestContext, OrchestSessionsConsumer } from "@/hooks/orchest";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";

class LogsView extends React.Component {
  static contextType = OrchestContext;

  constructor(props, context) {
    super(props, context);

    this.state = {
      selectedLog: undefined,
    };

    this.promiseManager = new PromiseManager();

    this.connectSocketIO();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    this.disconnectSocketIO();
  }

  componentDidMount() {
    this.fetchPipeline();
  }

  connectSocketIO() {
    // disable polling
    this.sio = io.connect("/pty", { transports: ["websocket"] });
  }

  disconnectSocketIO() {
    if (this.sio) {
      this.sio.disconnect();
    }
  }

  setHeaderComponent(pipelineName) {
    this.context.dispatch({
      type: "pipelineSet",
      payload: {
        pipeline_uuid: this.props.queryArgs.pipeline_uuid,
        project_uuid: this.props.queryArgs.project_uuid,
        pipelineName: pipelineName,
      },
    });
  }

  fetchPipeline() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.props.queryArgs.pipeline_uuid,
      this.props.queryArgs.project_uuid,
      this.props.queryArgs.job_uuid,
      this.props.queryArgs.run_uuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      this.promiseManager
    );

    pipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);

      if (result.success) {
        let pipelineJson = JSON.parse(result["pipeline_json"]);

        this.setHeaderComponent(pipelineJson.name);
        this.setState({
          pipelineJson: pipelineJson,
        });

        // set first step as selectedLog
        if (pipelineJson.steps && Object.keys(pipelineJson.steps)) {
          this.setState({
            selectedLog: Object.keys(pipelineJson.steps)[0],
          });
        }
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  close() {
    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: this.props.queryArgs.pipeline_uuid,
        project_uuid: this.props.queryArgs.project_uuid,
        read_only: this.props.queryArgs.read_only,
        job_uuid: this.props.queryArgs.job_uuid,
        run_uuid: this.props.queryArgs.run_uuid,
      },
    });
  }

  clickLog(event, item) {
    this.setState({
      selectedLog: item.step.uuid,
    });
  }

  render() {
    let rootView = undefined;

    if (this.state.pipelineJson) {
      let steps = [];

      for (let key of Object.keys(this.state.pipelineJson.steps)) {
        let step = this.state.pipelineJson.steps[key];
        steps.push({
          icon: "circle",
          step: step,
          label: (
            <>
              <span className="log-title">{step.title}</span>
              <br />
              <span>{step.file_path}</span>
            </>
          ),
        });
      }

      let services = [];
      const session = this.context.get.session(this.props.queryArgs);

      if (session && session.user_services) {
        for (let key of Object.keys(session.user_services)) {
          let service = session.user_services[key];

          services.push({
            icon: "settings",
            label: (
              <>
                <span className="log-title">{service.name}</span>
                <br />
                <span>{service.image}</span>
              </>
            ),
          });
        }
      }

      rootView = (
        <div className="logs">
          <div className="log-selector">
            <h2>Logs</h2>
            <MDCDrawerReact
              items={steps.concat("divider").concat(services)}
              action={this.clickLog.bind(this)}
            />
          </div>
          <div className="logs-xterm-holder">
            {this.state.selectedLog && (
              <LogViewer
                key={this.state.selectedLog}
                sio={this.sio}
                step_uuid={this.state.selectedLog}
                pipeline_uuid={this.props.queryArgs.pipeline_uuid}
                project_uuid={this.props.queryArgs.project_uuid}
                job_uuid={this.props.queryArgs.job_uuid}
                run_uuid={this.props.queryArgs.run_uuid}
              />
            )}
          </div>

          <div className="top-buttons">
            <MDCButtonReact
              classNames={["close-button"]}
              icon="close"
              onClick={this.close.bind(this)}
            />
          </div>
        </div>
      );
    } else {
      rootView = <MDCLinearProgressReact />;
    }

    return (
      <OrchestSessionsConsumer>
        <div className="view-page no-padding logs-view">{rootView}</div>
      </OrchestSessionsConsumer>
    );
  }
}

export default LogsView;
