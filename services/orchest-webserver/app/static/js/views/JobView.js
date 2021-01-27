import React from "react";
import cronstrue from "cronstrue";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import ParameterEditor from "../components/ParameterEditor";
import SearchableTable from "../components/SearchableTable";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import ParamTree from "../components/ParamTree";
import PipelineView from "./PipelineView";
import EditJobView from "./EditJobView";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";

class JobView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTabIndex: 0,
      selectedIndices: [0, 0],
      pipelineRuns: [],
      refreshing: false,
      parameterizedSteps: undefined,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  onSelectSubview(index) {
    this.setState({
      selectedTabIndex: index,
    });
  }

  fetchJob() {
    makeRequest("GET", `/catch/api-proxy/api/jobs/${this.props.job_uuid}`).then(
      (response) => {
        try {
          let job = JSON.parse(response);

          this.state.job = job;
          this.setState({
            job,
            parameterizedSteps: job.strategy_json,
          });

          this.fetchPipeline();
          this.fetchPipelineRuns();
        } catch (error) {
          console.error("Failed to fetch job.", error);
        }
      }
    );
  }

  fetchPipeline() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.state.job.pipeline_uuid,
      this.state.job.project_uuid,
      this.state.job.uuid
    );

    makeRequest("GET", pipelineJSONEndpoint).then((response) => {
      let result = JSON.parse(response);
      if (result.success) {
        let pipeline = JSON.parse(result["pipeline_json"]);

        this.setState({
          pipeline: pipeline,
        });
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  componentDidMount() {
    this.fetchJob();
  }

  fetchPipelineRuns() {
    let fetchRunsPromise = makeCancelable(
      makeRequest("GET", "/catch/api-proxy/api/jobs/" + this.state.job.uuid),
      this.promiseManager
    );

    fetchRunsPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          pipelineRuns: result.pipeline_runs,
          jobStatus: result.status,
          jobGeneratedParameters: result.parameters,
          refreshing: false,
        });
      })
      .catch((e) => {
        if (!e.isCanceled) {
          this.setState({
            refreshing: false,
          });
        }
      });
  }

  reload() {
    this.setState({
      refreshing: true,
    });
    this.fetchPipelineRuns();
  }

  onPipelineRunsSelectionChanged(selectedIndices) {
    this.setState({
      selectedIndices: selectedIndices,
    });
  }

  formatPipelineParams(parameters) {
    let keyValuePairs = [];

    for (let stepUUID in parameters) {
      for (let parameter in parameters[stepUUID]) {
        keyValuePairs.push(parameter + ": " + parameters[stepUUID][parameter]);
      }
    }
    return keyValuePairs.join(", ");
  }

  pipelineRunsToTableData(pipelineRuns) {
    let rows = [];

    for (let x = 0; x < pipelineRuns.length; x++) {
      rows.push([
        pipelineRuns[x].pipeline_run_index,
        this.formatPipelineParams(pipelineRuns[x].parameters),
        pipelineRuns[x].status,
      ]);
    }

    return rows;
  }

  parameterValueOverride(parameterizedSteps, parameters) {
    for (let stepUUID in parameters) {
      for (let parameter in parameters[stepUUID]) {
        parameterizedSteps[stepUUID]["parameters"][parameter] =
          parameters[stepUUID][parameter];
      }
    }

    return parameterizedSteps;
  }

  onDetailPipelineView(pipelineRun) {
    if (pipelineRun.status == "PENDING") {
      orchest.alert(
        "Error",
        "This pipeline is still pending. Please wait until pipeline run has started."
      );
      return;
    }

    orchest.loadView(PipelineView, {
      pipelineRun: pipelineRun,
      pipeline_uuid: pipelineRun.pipeline_uuid,
      project_uuid: pipelineRun.project_uuid,
      readOnly: true,
    });
  }

  cancelJob() {
    let deleteJobRequest = makeCancelable(
      makeRequest("DELETE", `/catch/api-proxy/api/jobs/${this.state.job.uuid}`),
      this.promiseManager
    );
    deleteJobRequest.promise
      .then(() => {
        this.setState({
          jobStatus: "ABORTED",
        });
      })
      .catch((error) => {
        console.error(error);
      });
  }

  generatedParametersToTableData(jobGeneratedParameters) {
    let rows = [];

    for (let idx in jobGeneratedParameters) {
      let params = jobGeneratedParameters[idx];

      let pipelineRunRow = [];

      for (let fullParam in params) {
        for (let paramKey in params[fullParam]) {
          pipelineRunRow.push(paramKey + ": " + params[fullParam][paramKey]);
        }
      }
      if (pipelineRunRow.length > 0) {
        rows.push([pipelineRunRow.join(", ")]);
      } else {
        rows.push(["-"]);
      }
    }

    return rows;
  }

  editJob() {
    orchest.loadView(EditJobView, {
      job_uuid: this.state.job.uuid,
    });
  }

  detailRows(pipelineRuns) {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineRuns.length; x++) {
      let pipelineRun = pipelineRuns[x];
      let parameterizedSteps = JSON.parse(
        JSON.stringify(this.state.parameterizedSteps)
      );

      parameterizedSteps = this.parameterValueOverride(
        parameterizedSteps,
        pipelineRun.parameters
      );

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree parameterizedSteps={parameterizedSteps} />
          <MDCButtonReact
            label="View pipeline"
            classNames={["mdc-button--raised", "themed-secondary"]}
            icon="visibility"
            onClick={this.onDetailPipelineView.bind(this, pipelineRun)}
          />
        </div>
      );
    }

    return detailElements;
  }

  render() {
    let rootView;

    if (!this.state.pipeline || !this.state.pipelineRuns || !this.state.job) {
      rootView = <MDCLinearProgressReact />;
    } else {
      let tabView = undefined;

      switch (this.state.selectedTabIndex) {
        case 0:
          tabView = (
            <div className="pipeline-tab-view existing-pipeline-runs">
              <SearchableTable
                rows={this.pipelineRunsToTableData(this.state.pipelineRuns)}
                detailRows={this.detailRows(this.state.pipelineRuns)}
                headers={["ID", "Parameters", "Status"]}
                selectedIndices={this.state.selectedIndices}
                onSelectionChanged={this.onPipelineRunsSelectionChanged.bind(
                  this
                )}
              />
            </div>
          );

          break;
        case 1:
          tabView = (
            <div className="pipeline-tab-view">
              <ParameterEditor
                readOnly
                parameterizedSteps={this.state.parameterizedSteps}
              />

              <div className="pipeline-runs push-up">
                <SearchableTable
                  selectable={false}
                  headers={["Run specification"]}
                  rows={this.generatedParametersToTableData(
                    this.state.jobGeneratedParameters
                  )}
                />
              </div>
            </div>
          );
          break;
      }

      rootView = (
        <div className="view-page job-view">
          <div className="columns top-labels">
            <div>
              <div className="column">
                <label>Job</label>
                <h3>{this.state.job.name}</h3>
              </div>
              <div className="column">
                <label>Pipeline</label>
                <h3>{this.state.pipeline.name}</h3>
              </div>
              <div className="clear"></div>
            </div>
            <div className="push-up">
              <div className="column">
                <label>Job status</label>
                <h3>{this.state.jobStatus}</h3>
              </div>
              <div className="column">
                <label>Schedule</label>
                <h3>
                  {this.state.job.schedule === null
                    ? "Run once"
                    : this.state.job.schedule}
                </h3>
                {this.state.job.schedule !== null && (
                  <p>
                    <i>{cronstrue.toString(this.state.job.schedule)}</i>
                  </p>
                )}
              </div>
              <div className="clear"></div>
            </div>
          </div>

          <MDCTabBarReact
            selectedIndex={this.state.selectedTabIndex}
            ref={this.refManager.nrefs.tabBar}
            items={[
              "Pipeline runs (" + this.state.pipelineRuns.length + ")",
              "Parameters",
            ]}
            icons={["list", "tune"]}
            onChange={this.onSelectSubview.bind(this)}
          />

          <div className="tab-view">{tabView}</div>

          <div className="seperated">
            <MDCButtonReact
              disabled={this.state.refreshing}
              label="Refresh"
              icon="refresh"
              onClick={this.reload.bind(this)}
            />

            {this.state.job.schedule !== null &&
              ["STARTED", "PENDING"].includes(this.state.jobStatus) && (
                <MDCButtonReact
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={this.editJob.bind(this)}
                  icon="tune"
                  label="Edit"
                />
              )}

            {["STARTED", "PENDING"].includes(this.state.jobStatus) && (
              <MDCButtonReact
                classNames={["mdc-button--raised"]}
                label="Cancel job"
                icon="close"
                onClick={this.cancelJob.bind(this)}
              />
            )}
          </div>
        </div>
      );
    }

    return <div className="view-page job-view">{rootView}</div>;
  }
}

export default JobView;
