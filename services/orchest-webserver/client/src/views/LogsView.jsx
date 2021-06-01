import React from "react";
import PipelineView from "./PipelineView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "@orchest/lib-utils";

import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";

import {
  MDCButtonReact,
  MDCLinearProgressReact,
  MDCDrawerReact,
} from "@orchest/lib-mdc";
import { OrchestContext } from "@/hooks/orchest";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";

class LogsView extends React.Component {
  static contextType = OrchestContext;

  constructor(props, context) {
    super(props, context);

    this.state = {};

    this.fitAddon = new FitAddon();
    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchPipeline();
  }

  componentDidUpdate(prevProps) {}

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

  clickLog(event, item) {}

  render() {
    let rootView = undefined;

    if (this.state.pipelineJson) {
      let steps = [];
      let services = [];

      for (let key of Object.keys(this.state.pipelineJson.steps)) {
        let step = this.state.pipelineJson.steps[key];
        steps.push({
          icon: "text_snippet",
          label: (
            <>
              <span className="log-title">{step.title}</span>
              <br />
              <span>({step.file_path})</span>
            </>
          ),
        });
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
            <XTerm addons={[this.fitAddon]} ref={this.refManager.nrefs.term} />
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

    return <div className="view-page no-padding logs-view">{rootView}</div>;
  }
}

export default LogsView;
