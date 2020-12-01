import React, { Fragment } from "react";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import ParameterEditor from "../components/ParameterEditor";
import DateTimeInput from "../components/DateTimeInput";
import ExperimentsView from "./ExperimentsView";
import SearchableTable from "../components/SearchableTable";
import { makeRequest, PromiseManager, RefManager } from "../lib/utils/all";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import ParamTree from "../components/ParamTree";
import MDCRadioReact from "../lib/mdc-components/MDCRadioReact";
import { makeCancelable } from "../lib/utils/all";
import {
  checkGate,
  getPipelineJSONEndpoint,
  requestBuild,
} from "../utils/webserver-utils";

class CreateExperimentView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTabIndex: 0,
      parameterizedSteps: undefined,
      generatedPipelineRuns: [],
      generatedPipelineRunRows: [],
      selectedIndices: [],
      scheduleOption: "now",
      pipeline: undefined,
      runExperimentLoading: false,
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  fetchPipeline() {
    let fetchPipelinePromise = makeCancelable(
      makeRequest(
        "GET",
        getPipelineJSONEndpoint(
          this.props.experiment.pipeline_uuid,
          this.props.experiment.project_uuid,
          this.props.experiment.uuid
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
          parameterizedSteps: this.generateParameterizedSteps(pipeline),
        });

        this.onParameterChange();
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  }

  generateParameterizedSteps(pipeline) {
    let parameterizedSteps = {};
    for (const stepUUID in pipeline.steps) {
      let parameterizedStep = JSON.parse(
        JSON.stringify(pipeline.steps[stepUUID])
      );

      if (
        parameterizedStep.parameters &&
        Object.keys(parameterizedStep.parameters).length > 0
      ) {
        for (const paramKey in parameterizedStep.parameters) {
          // Note: the list of parameters for each key will always be
          // a string in the 'parameterizedSteps' data structure. This
          // facilitates preserving user added indendation.

          // Validity of the user string as JSON is checked client
          // side (for now).
          parameterizedStep.parameters[paramKey] = JSON.stringify([
            parameterizedStep.parameters[paramKey],
          ]);
        }

        // selectively persist only required fields for use in parameter
        // related React components
        parameterizedSteps[stepUUID] = {
          uuid: stepUUID,
          parameters: parameterizedStep.parameters,
          title: parameterizedStep.title,
        };
      }
    }

    return parameterizedSteps;
  }

  onSelectSubview(index) {
    this.setState({
      selectedTabIndex: index,
    });
  }

  componentDidMount() {
    this.fetchPipeline();
  }

  onParameterChange() {
    // flatten and JSONify parameterizedSteps to prep data structure for algo
    let flatParameters = {};

    for (const stepUUID in this.state.parameterizedSteps) {
      for (const paramKey in this.state.parameterizedSteps[stepUUID]
        .parameters) {
        let fullParam = stepUUID + "#" + paramKey;

        flatParameters[fullParam] = JSON.parse(
          this.state.parameterizedSteps[stepUUID].parameters[paramKey]
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
        pipelineRunRow.push(paramName + ": " + params[fullParam]);
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

  validateExperimentConfig() {
    if (this.state.selectedIndices.reduce((acc, val) => acc + val, 0) == 0) {
      return {
        pass: false,
        reason:
          "You selected 0 pipeline runs. Please choose at least one pipeline run configuration.",
      };
    }
    return { pass: true };
  }

  attemptRunExperiment() {
    // validate experiment configuration
    let validation = this.validateExperimentConfig();

    if (validation.pass === true) {
      checkGate(this.props.experiment.project_uuid)
        .then(() => {
          this.runExperiment();
        })
        .catch((result) => {
          if (result.reason === "gate-failed") {
            requestBuild(
              this.props.experiment.project_uuid,
              result.data,
              "CreateExperiment"
            ).catch((e) => {});
          }
        });
    } else {
      orchest.alert("Error", validation.reason);
    }
  }

  runExperiment() {
    this.setState({
      runExperimentLoading: true,
    });

    let formValueScheduledStart;

    if (this.state.scheduleOption === "scheduled") {
      formValueScheduledStart = this.refManager.refs.scheduledDateTime.getISOString();
    } else {
      formValueScheduledStart = new Date().toISOString();
    }

    // API doesn't accept ISO date strings with 'Z' suffix
    if (formValueScheduledStart[formValueScheduledStart.length - 1] === "Z") {
      formValueScheduledStart = formValueScheduledStart.slice(
        0,
        formValueScheduledStart.length - 1
      );
    }

    // TODO: instead of bouncing three requests
    // (orchest-api, orchest-webserver, orchest-webserver)
    // perhaps wrap this into one larger request that goes straight
    // to orchest-webserver (more ACID? - no partial success)
    let pipelineDefinitions = this.generatePipelineDefinitions(
      this.state.pipeline,
      this.state.generatedPipelineRuns,
      this.state.selectedIndices
    );

    let pipelineRunIds = new Array(pipelineDefinitions.length);
    for (let x = 0; x < pipelineRunIds.length; x++) {
      pipelineRunIds[x] = x + 1;
    }

    let apiExperimentData = {
      experiment_uuid: this.props.experiment.uuid,
      pipeline_uuid: this.state.pipeline.uuid,
      project_uuid: this.props.experiment.project_uuid,
      pipeline_definitions: pipelineDefinitions,
      pipeline_run_ids: pipelineRunIds,
      pipeline_run_spec: {
        run_type: "full",
        uuids: [],
      },
      scheduled_start: formValueScheduledStart,
    };

    makeRequest("POST", "/catch/api-proxy/api/experiments/", {
      type: "json",
      content: apiExperimentData,
    })
      .then((response) => {
        let apiResult = JSON.parse(response);

        let experimentData = {
          pipeline_uuid: this.state.pipeline.uuid,
          pipeline_name: this.state.pipeline.name,
          name: this.props.experiment.name,
          strategy_json: JSON.stringify(this.state.parameterizedSteps),
          draft: false,
        };

        let webserverPromises = [];

        let storeExperimentPromise = makeRequest(
          "PUT",
          "/store/experiments/" + this.props.experiment.uuid,
          {
            type: "json",
            content: experimentData,
          }
        );
        webserverPromises.push(storeExperimentPromise);

        storeExperimentPromise.catch((e) => {
          console.log(e);
        });

        let pipelineRunsPromise = makeRequest(
          "POST",
          "/async/pipelineruns/create",
          {
            type: "json",
            content: {
              experiment_uuid: this.props.experiment.uuid,
              generated_pipeline_runs: this.state.generatedPipelineRuns,
              selected_indices: this.state.selectedIndices,
              experiment_json: apiResult,
            },
          }
        );
        webserverPromises.push(pipelineRunsPromise);

        pipelineRunsPromise.catch((e) => {
          console.log(e);
        });

        Promise.all(webserverPromises).then(() => {
          orchest.loadView(ExperimentsView, {
            project_uuid: this.props.experiment.project_uuid,
          });
        });
      })
      .catch((response) => {
        try {
          let data = JSON.parse(response.body);
          orchest.alert(
            "Error",
            "There was a problem submitting your experiment. " + data.message
          );
        } catch {
          orchest.alert(
            "Error",
            "There was a problem submitting your experiment. Unknown error."
          );
        }
      });
  }

  generatePipelineDefinitions(
    pipeline,
    generatedPipelineRuns,
    selectedIndices
  ) {
    let pipelineJSONs = [];

    for (let x = 0; x < generatedPipelineRuns.length; x++) {
      if (selectedIndices[x] === 1) {
        let runParameters = generatedPipelineRuns[x];
        let pipelineJSON = JSON.parse(JSON.stringify(pipeline));

        // key is formatted: <stepUUID>#<parameterKey>
        for (let key in runParameters) {
          let keySplit = key.split("#");
          let stepUUID = keySplit[0];
          let parameterKey = keySplit.slice(1).join("#");
          pipelineJSON.steps[stepUUID].parameters[parameterKey] =
            runParameters[key];
        }
        pipelineJSONs.push(pipelineJSON);
      }
    }

    return pipelineJSONs;
  }

  cancel() {
    orchest.loadView(ExperimentsView, {
      project_uuid: this.props.experiment.project_uuid,
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

  parameterValueOverride(parameterizedSteps, parameters) {
    for (let key in parameters) {
      let splitKey = key.split("#");
      let stepUUID = splitKey[0];
      let paramKey = splitKey.slice(1).join("#");
      let paramValue = parameters[key];

      parameterizedSteps[stepUUID]["parameters"][paramKey] = paramValue;
    }

    return parameterizedSteps;
  }

  detailRows(pipelineParameters) {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineParameters.length; x++) {
      let parameters = pipelineParameters[x];
      let parameterizedSteps = JSON.parse(
        JSON.stringify(this.state.parameterizedSteps)
      );

      parameterizedSteps = this.parameterValueOverride(
        parameterizedSteps,
        parameters
      );

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree parameterizedSteps={parameterizedSteps} />
        </div>
      );
    }

    return detailElements;
  }

  render() {
    let rootView = undefined;

    if (this.state.pipeline) {
      let tabView = undefined;

      switch (this.state.selectedTabIndex) {
        case 0:
          tabView = (
            <ParameterEditor
              onParameterChange={this.onParameterChange.bind(this)}
              parameterizedSteps={this.state.parameterizedSteps}
            />
          );
          break;
        case 1:
          tabView = (
            <div className="tab-view">
              <div>
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
              <div>
                <MDCRadioReact
                  label="Scheduled"
                  value="scheduled"
                  name="time"
                  checked={this.state.scheduleOption === "scheduled"}
                  onChange={(e) => {
                    this.setState({ scheduleOption: e.target.value });
                  }}
                />

                <DateTimeInput
                  ref={this.refManager.nrefs.scheduledDateTime}
                  onFocus={() => this.setState({ scheduleOption: "scheduled" })}
                />
              </div>
            </div>
          );
          break;
        case 2:
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
              <label>Experiment</label>
              <h3>{this.props.experiment.name}</h3>
            </div>
            <div className="column">
              <label>Pipeline</label>
              <h3>{this.state.pipeline.name}</h3>
            </div>
          </div>

          <MDCTabBarReact
            selectedIndex={this.state.selectedTabIndex}
            ref={this.refManager.nrefs.tabBar}
            items={[
              "Parameters",
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
            icons={["tune", "schedule", "list"]}
            onChange={this.onSelectSubview.bind(this)}
          />

          <div className="tab-view">{tabView}</div>

          <div className="buttons">
            <MDCButtonReact
              disabled={this.state.runExperimentLoading}
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={this.attemptRunExperiment.bind(this)}
              icon="play_arrow"
              label="Run experiment"
            />
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

    return <div className="view-page experiment-view">{rootView}</div>;
  }
}

export default CreateExperimentView;
