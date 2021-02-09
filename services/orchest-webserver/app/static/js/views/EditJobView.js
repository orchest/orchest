import React, { Fragment } from "react";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCRadioReact from "../lib/mdc-components/MDCRadioReact";
import ParameterEditor from "../components/ParameterEditor";
import CronScheduleInput from "../components/CronScheduleInput";
import DateTimeInput from "../components/DateTimeInput";
import JobsView from "./JobsView";
import SearchableTable from "../components/SearchableTable";
import { makeRequest, PromiseManager, RefManager } from "../lib/utils/all";
import ParamTree from "../components/ParamTree";
import { makeCancelable } from "../lib/utils/all";
import EnvVarList from "../components/EnvVarList";

import {
  checkGate,
  getPipelineJSONEndpoint,
  requestBuild,
  envVariablesArrayToDict,
  envVariablesDictToArray,
} from "../utils/webserver-utils";
import JobView from "./JobView";

class EditJobView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTabIndex: 0,
      generatedPipelineRuns: [],
      generatedPipelineRunRows: [],
      selectedIndices: [],
      scheduleOption: "now",
      runJobLoading: false,
      pipeline: undefined,
      cronString: undefined,
      strategyJSON: {},
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  fetchJob() {
    let fetchJobPromise = makeCancelable(
      makeRequest("GET", `/catch/api-proxy/api/jobs/${this.props.job_uuid}`),
      this.promiseManager
    );

    fetchJobPromise.promise.then((response) => {
      try {
        let job = JSON.parse(response);

        this.state.job = job;

        this.setState({
          job: job,
          cronString: job.schedule === null ? "* * * * *" : job.schedule,
          scheduleOption: job.schedule === null ? "now" : "cron",
          envVariables: envVariablesDictToArray(job["env_variables"]),
        });

        if (job.status !== "DRAFT") {
          this.setState({
            strategyJSON: job.strategy_json,
          });
        }

        this.fetchPipeline();
      } catch (error) {
        console.error(error);
      }
    });
  }

  fetchPipeline() {
    let fetchPipelinePromise = makeCancelable(
      makeRequest(
        "GET",
        getPipelineJSONEndpoint(
          this.state.job.pipeline_uuid,
          this.state.job.project_uuid,
          this.state.job.uuid
        )
      ),
      this.promiseManager
    );

    fetchPipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);
      if (result.success) {
        let pipeline = JSON.parse(result["pipeline_json"]);

        this.setState({
          pipeline: pipeline,
        });

        if (this.state.job.status === "DRAFT") {
          this.setState({
            strategyJSON: this.generateStrategyJson(pipeline),
          });
        }

        this.onParameterChange();
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  generateParameterLists(parameters) {
    let parameterLists = {};

    for (const paramKey in parameters) {
      // Note: the list of parameters for each key will always be
      // a string in the 'strategyJSON' data structure. This
      // facilitates preserving user added indendation.

      // Validity of the user string as JSON is checked client
      // side (for now).
      parameterLists[paramKey] = JSON.stringify([parameters[paramKey]]);
    }

    return parameterLists;
  }

  generateStrategyJson(pipeline) {
    let strategyJSON = {};

    if (pipeline.parameters && Object.keys(pipeline.parameters).length > 0) {
      strategyJSON[orchest.config["PIPELINE_PARAMETERS_RESERVED_KEY"]] = {
        key: orchest.config["PIPELINE_PARAMETERS_RESERVED_KEY"],
        parameters: this.generateParameterLists(pipeline.parameters),
        title: pipeline.name,
      };
    }

    for (const stepUUID in pipeline.steps) {
      let stepStrategy = JSON.parse(JSON.stringify(pipeline.steps[stepUUID]));

      if (
        stepStrategy.parameters &&
        Object.keys(stepStrategy.parameters).length > 0
      ) {
        // selectively persist only required fields for use in parameter
        // related React components
        strategyJSON[stepUUID] = {
          key: stepUUID,
          parameters: this.generateParameterLists(stepStrategy.parameters),
          title: stepStrategy.title,
        };
      }
    }

    return strategyJSON;
  }

  onSelectSubview(index) {
    this.setState({
      selectedTabIndex: index,
    });
  }

  componentDidMount() {
    this.fetchJob();
  }

  onParameterChange() {
    // flatten and JSONify strategyJSON to prep data structure for algo
    let flatParameters = {};

    for (const strategyJSONKey in this.state.strategyJSON) {
      for (const paramKey in this.state.strategyJSON[strategyJSONKey]
        .parameters) {
        let fullParam = strategyJSONKey + "#" + paramKey;

        flatParameters[fullParam] = JSON.parse(
          this.state.strategyJSON[strategyJSONKey].parameters[paramKey]
        );
      }
    }

    let recursivelyGenerate = function (params, accum, unpacked) {
      // deep clone unpacked
      unpacked = JSON.parse(JSON.stringify(unpacked));

      for (const fullParam in params) {
        if (unpacked.indexOf(fullParam) === -1) {
          unpacked.push(fullParam);

          for (const idx in params[fullParam]) {
            // deep clone params
            let localParams = JSON.parse(JSON.stringify(params));

            // collapse param list to paramValue
            localParams[fullParam] = params[fullParam][idx];

            recursivelyGenerate(localParams, accum, unpacked);
          }
          return;
        }
      }

      accum.push(params);
    };

    let pipelineRuns = [];

    recursivelyGenerate(flatParameters, pipelineRuns, []);

    // transform pipelineRuns for generatedPipelineRuns DataTable format
    let generatedPipelineRuns = [];

    for (let idx in pipelineRuns) {
      let params = pipelineRuns[idx];

      let pipelineRunRow = [];

      for (let fullParam in params) {
        let paramName = fullParam.split("#").slice(1).join("");
        pipelineRunRow.push(
          paramName + ": " + JSON.stringify(params[fullParam])
        );
      }
      if (pipelineRunRow.length > 0) {
        generatedPipelineRuns.push([pipelineRunRow.join(", ")]);
      } else {
        generatedPipelineRuns.push(["-"]);
      }
    }

    let selectedIndices = Array(generatedPipelineRuns.length).fill(1);

    this.setState({
      generatedPipelineRuns: pipelineRuns,
      generatedPipelineRunRows: generatedPipelineRuns,
      selectedIndices: selectedIndices,
    });
  }

  validateJobConfig() {
    if (this.state.selectedIndices.reduce((acc, val) => acc + val, 0) == 0) {
      return {
        pass: false,
        reason:
          "You selected 0 pipeline runs. Please choose at least one pipeline run configuration.",
      };
    }
    return { pass: true };
  }

  attemptRunJob() {
    // validate job configuration
    let validation = this.validateJobConfig();

    if (validation.pass === true) {
      checkGate(this.state.job.project_uuid)
        .then(() => {
          this.runJob();
        })
        .catch((result) => {
          if (result.reason === "gate-failed") {
            requestBuild(
              this.state.job.project_uuid,
              result.data,
              "CreateJob"
            ).catch((e) => {});
          }
        });
    } else {
      orchest.alert("Error", validation.reason);
    }
  }

  runJob() {
    this.setState({
      runJobLoading: true,
    });

    let envVariables = envVariablesArrayToDict(this.state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      this.setState({
        runJobLoading: false,
      });
      this.onSelectSubview(1);
      return;
    }

    let jobPUTData = {
      confirm_draft: true,
      strategy_json: this.state.strategyJSON,
      parameters: this.generateJobParameters(
        this.state.generatedPipelineRuns,
        this.state.selectedIndices
      ),
      env_variables: envVariables,
    };

    if (this.state.scheduleOption === "scheduled") {
      let formValueScheduledStart = this.refManager.refs.scheduledDateTime.getISOString();

      // API doesn't accept ISO date strings with 'Z' suffix
      // Instead, endpoint assumes its passed a UTC datetime string.
      if (formValueScheduledStart[formValueScheduledStart.length - 1] === "Z") {
        formValueScheduledStart = formValueScheduledStart.slice(
          0,
          formValueScheduledStart.length - 1
        );
      }

      jobPUTData.next_scheduled_time = formValueScheduledStart;
    } else if (this.state.scheduleOption === "cron") {
      jobPUTData.cron_schedule = this.state.cronString;
    }
    // Else: both entries are undefined, the run is considered to be
    // started ASAP.

    // Update orchest-api through PUT.
    // Note: confirm_draft will trigger the start the job.
    let putJobPromise = makeRequest(
      "PUT",
      "/catch/api-proxy/api/jobs/" + this.state.job.uuid,
      {
        type: "json",
        content: jobPUTData,
      }
    );

    putJobPromise
      .then(() => {
        orchest.loadView(JobsView, {
          project_uuid: this.state.job.project_uuid,
        });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  putJobChanges() {
    /* This function should only be called
     *  for jobs with a cron schedule. As those
     *  are the only ones that are allowed to be changed
     *  when they are not a draft.
     */

    let jobParameters = this.generateJobParameters(
      this.state.generatedPipelineRuns,
      this.state.selectedIndices
    );

    let cronSchedule = this.state.cronString;
    let envVariables = envVariablesArrayToDict(this.state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      this.onSelectSubview(1);
      return;
    }

    let putJobRequest = makeCancelable(
      makeRequest("PUT", `/catch/api-proxy/api/jobs/${this.state.job.uuid}`, {
        type: "json",
        content: {
          cron_schedule: cronSchedule,
          parameters: jobParameters,
          strategy_json: this.state.strategyJSON,
          env_variables: envVariables,
        },
      }),
      this.promiseManager
    );

    putJobRequest.promise
      .then(() => {
        orchest.loadView(JobView, {
          job_uuid: this.state.job.uuid,
        });
      })
      .catch((error) => {
        console.error(error);
      });
  }

  generateJobParameters(generatedPipelineRuns, selectedIndices) {
    let parameters = [];

    for (let x = 0; x < generatedPipelineRuns.length; x++) {
      if (selectedIndices[x] === 1) {
        let runParameters = generatedPipelineRuns[x];
        let selectedRunParameters = {};

        // key is formatted: <stepUUID>#<parameterKey>
        for (let key in runParameters) {
          let keySplit = key.split("#");
          let stepUUID = keySplit[0];
          let parameterKey = keySplit.slice(1).join("#");

          if (selectedRunParameters[stepUUID] === undefined)
            selectedRunParameters[stepUUID] = {};

          selectedRunParameters[stepUUID][parameterKey] = runParameters[key];
        }

        parameters.push(selectedRunParameters);
      }
    }

    return parameters;
  }

  cancel() {
    orchest.loadView(JobsView, {
      project_uuid: this.state.job.project_uuid,
    });
  }

  onPipelineRunsSelectionChanged(selectedRows, rows) {
    // map selectedRows to selectedIndices
    let selectedIndices = this.state.selectedIndices;

    // for indexOf to work on arrays in this.generatedPipelineRuns it
    // depends on the object being the same (same reference)
    for (let x = 0; x < rows.length; x++) {
      let index = this.state.generatedPipelineRunRows.indexOf(rows[x]);

      if (index === -1) {
        console.error("row should always be in generatedPipelineRunRows");
      }

      if (selectedRows.indexOf(rows[x]) !== -1) {
        selectedIndices[index] = 1;
      } else {
        selectedIndices[index] = 0;
      }
    }

    this.setState({
      selectedIndices: selectedIndices,
    });
  }

  parameterValueOverride(strategyJSON, parameters) {
    for (let key in parameters) {
      let splitKey = key.split("#");
      let strategyJSONKey = splitKey[0];
      let paramKey = splitKey.slice(1).join("#");
      let paramValue = parameters[key];

      strategyJSON[strategyJSONKey]["parameters"][paramKey] = paramValue;
    }

    return strategyJSON;
  }

  setCronSchedule(cronString) {
    this.setState({
      cronString: cronString,
      scheduleOption: "cron",
    });
  }

  addEnvVariablePair(e) {
    e.preventDefault();

    const envVariables = this.state.envVariables.slice();
    this.setState({
      envVariables: envVariables.concat([
        {
          name: null,
          value: null,
        },
      ]),
    });
  }

  onEnvVariablesChange(value, idx, type) {
    const envVariables = this.state.envVariables.slice();
    envVariables[idx][type] = value;

    this.setState({
      envVariables: envVariables,
    });
  }

  onEnvVariablesDeletion(idx) {
    const envVariables = this.state.envVariables.slice();
    envVariables.splice(idx, 1);
    this.setState({
      envVariables: envVariables,
    });
  }

  detailRows(pipelineParameters) {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineParameters.length; x++) {
      let parameters = pipelineParameters[x];
      let strategyJSON = JSON.parse(JSON.stringify(this.state.strategyJSON));

      strategyJSON = this.parameterValueOverride(strategyJSON, parameters);

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree
            pipelineName={this.state.pipeline.name}
            strategyJSON={strategyJSON}
          />
        </div>
      );
    }

    return detailElements;
  }

  render() {
    let rootView = undefined;

    if (this.state.job && this.state.pipeline) {
      let tabView = undefined;

      switch (this.state.selectedTabIndex) {
        case 0:
          tabView = (
            <div className="tab-view">
              <ParameterEditor
                pipelineName={this.state.pipeline.name}
                onParameterChange={this.onParameterChange.bind(this)}
                strategyJSON={this.state.strategyJSON}
              />
            </div>
          );
          break;
        case 1:
          tabView = (
            <div className="tab-view">
              <p className="push-down">
                Override any project or pipeline environment variables here.
              </p>
              <EnvVarList
                value={this.state.envVariables}
                onAdd={this.addEnvVariablePair.bind(this)}
                onChange={(e, idx, type) =>
                  this.onEnvVariablesChange(e, idx, type)
                }
                onDelete={(idx) => this.onEnvVariablesDeletion(idx)}
              />
            </div>
          );
          break;
        case 2:
          tabView = (
            <div className="tab-view">
              {this.state.job.status === "DRAFT" && (
                <div>
                  <div className="push-down">
                    <MDCRadioReact
                      label="Now"
                      value="now"
                      name="time"
                      checked={this.state.scheduleOption === "now"}
                      onChange={(e) => {
                        this.setState({ scheduleOption: e.target.value });
                      }}
                    />
                  </div>
                  <div className="push-down">
                    <MDCRadioReact
                      label="Scheduled"
                      value="scheduled"
                      name="time"
                      checked={this.state.scheduleOption === "scheduled"}
                      onChange={(e) => {
                        this.setState({ scheduleOption: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <DateTimeInput
                      disabled={this.state.scheduleOption !== "scheduled"}
                      ref={this.refManager.nrefs.scheduledDateTime}
                      onFocus={() =>
                        this.setState({ scheduleOption: "scheduled" })
                      }
                    />
                  </div>
                </div>
              )}

              {this.state.job.status === "DRAFT" && (
                <div className="push-down">
                  <MDCRadioReact
                    label="Cron job"
                    value="cron"
                    name="time"
                    checked={this.state.scheduleOption === "cron"}
                    onChange={(e) => {
                      this.setState({ scheduleOption: e.target.value });
                    }}
                  />
                </div>
              )}

              <div>
                <CronScheduleInput
                  cronString={this.state.cronString}
                  onChange={this.setCronSchedule.bind(this)}
                  disabled={this.state.scheduleOption !== "cron"}
                />
              </div>
            </div>
          );
          break;
        case 3:
          tabView = (
            <div className="pipeline-tab-view pipeline-runs">
              <SearchableTable
                selectable={true}
                headers={["Parameters"]}
                detailRows={this.detailRows(this.state.generatedPipelineRuns)}
                rows={this.state.generatedPipelineRunRows}
                selectedIndices={this.state.selectedIndices}
                onSelectionChanged={this.onPipelineRunsSelectionChanged.bind(
                  this
                )}
              />
            </div>
          );
          break;
      }

      rootView = (
        <Fragment>
          <div className="columns top-labels">
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

          <MDCTabBarReact
            selectedIndex={this.state.selectedTabIndex}
            ref={this.refManager.nrefs.tabBar}
            items={[
              "Parameters",
              "Environment variables",
              "Scheduling",
              "Pipeline runs (" +
                this.state.selectedIndices.reduce(
                  (total, num) => total + num,
                  0
                ) +
                "/" +
                this.state.generatedPipelineRuns.length +
                ")",
            ]}
            icons={["tune", "view_comfy", "schedule", "list"]}
            onChange={this.onSelectSubview.bind(this)}
          />

          <div className="tab-view">{tabView}</div>

          <div className="buttons">
            {this.state.job.status === "DRAFT" && (
              <MDCButtonReact
                disabled={this.state.runJobLoading}
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={this.attemptRunJob.bind(this)}
                icon="play_arrow"
                label="Run job"
              />
            )}
            {this.state.job.status !== "DRAFT" && (
              <MDCButtonReact
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={this.putJobChanges.bind(this)}
                icon="save"
                label="Update job"
              />
            )}
            <MDCButtonReact
              onClick={this.cancel.bind(this)}
              label="Cancel"
              icon="close"
            />
          </div>
        </Fragment>
      );
    } else {
      rootView = <MDCLinearProgressReact />;
    }

    return <div className="view-page job-view">{rootView}</div>;
  }
}

export default EditJobView;
