import React from "react";
import { useHistory } from "react-router-dom";
import parser from "cron-parser";
import _ from "lodash";
import {
  MDCTabBarReact,
  MDCButtonReact,
  MDCLinearProgressReact,
  MDCRadioReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";

import {
  getPipelineJSONEndpoint,
  envVariablesArrayToDict,
  envVariablesDictToArray,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import type { TViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import { DescriptionList } from "@/components/DescriptionList";
import ParameterEditor from "@/components/ParameterEditor";
import CronScheduleInput from "@/components/CronScheduleInput";
import DateTimeInput from "@/components/DateTimeInput";
import SearchableTable from "@/components/SearchableTable";
import ParamTree from "@/components/ParamTree";
import EnvVarList from "@/components/EnvVarList";
import JobView from "@/views/JobView";
import JobsView from "@/views/JobsView";
import { generatePathFromRoute, siteMap } from "@/Routes";

const EditJobView: React.FC<TViewProps> = (props) => {
  const { orchest } = window;
  const history = useHistory();

  const context = useOrchest();

  const [state, setState] = React.useState({
    job: undefined,
    envVariables: null,
    selectedTabIndex: 0,
    shouldFetchPipeline: false,
    generatedPipelineRuns: [],
    generatedPipelineRunRows: [],
    selectedIndices: [],
    scheduleOption: "now",
    runJobLoading: false,
    runJobCompleted: false,
    pipeline: undefined,
    cronString: undefined,
    strategyJSON: {},
  });

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());

  const fetchJob = () => {
    let fetchJobPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/jobs/${props.queryArgs.job_uuid}`
      ),
      promiseManager
    );

    fetchJobPromise.promise.then((response) => {
      try {
        let job = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          job,
          cronString: job.schedule === null ? "* * * * *" : job.schedule,
          scheduleOption: job.schedule === null ? "now" : "cron",
          envVariables: envVariablesDictToArray(job["env_variables"]),
        }));

        if (job.status !== "DRAFT") {
          setState((prevState) => ({
            ...prevState,
            strategyJSON: job.strategy_json,
          }));
        } else {
          context.dispatch({
            type: "setUnsavedChanges",
            payload: true,
          });
        }

        setState((prevState) => ({ ...prevState, shouldFetchPipeline: true }));
      } catch (error) {
        console.error(error);
      }
    });
  };

  const fetchPipeline = () => {
    let fetchPipelinePromise = makeCancelable(
      makeRequest(
        "GET",
        getPipelineJSONEndpoint(
          state.job.pipeline_uuid,
          state.job.project_uuid,
          state.job.uuid
        )
      ),
      promiseManager
    );

    fetchPipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);
      if (result.success) {
        let pipeline = JSON.parse(result["pipeline_json"]);

        let strategyJSON;

        // Do not generate another strategy_json if it has been defined
        // already.
        if (
          state.job.status === "DRAFT" &&
          Object.keys(state.job.strategy_json).length === 0
        ) {
          strategyJSON = generateStrategyJson(pipeline);
        } else {
          strategyJSON = state.job.strategy_json;
        }

        let [
          generatedPipelineRuns,
          generatedPipelineRunRows,
          selectedIndices,
        ] = generateWithStrategy(strategyJSON);

        // Account for the fact that a job might have a list of
        // parameters already defined, i.e. when editing a non draft
        // job or when duplicating a job.
        if (state.job.parameters.length > 0) {
          // Determine selection based on strategyJSON
          selectedIndices = parseParameters(
            state.job.parameters,
            generatedPipelineRuns
          );
        }

        setState((prevState) => ({
          ...prevState,
          pipeline,
          strategyJSON,
          generatedPipelineRuns,
          generatedPipelineRunRows,
          selectedIndices,
        }));
      } else {
        console.warn("Could not load pipeline.json");
      }
    });
  };

  const findParameterization = (parameterization, parameters) => {
    let JSONstring = JSON.stringify(parameterization);
    for (let x = 0; x < parameters.length; x++) {
      if (JSON.stringify(parameters[x]) == JSONstring) {
        return x;
      }
    }
    return -1;
  };

  const parseParameters = (parameters, generatedPipelineRuns) => {
    let _parameters = _.cloneDeep(parameters);
    let selectedIndices = Array(generatedPipelineRuns.length).fill(1);

    for (let x = 0; x < generatedPipelineRuns.length; x++) {
      let run = generatedPipelineRuns[x];
      let encodedParameterization = generateJobParameters([run], [1])[0];

      let needleIndex = findParameterization(
        encodedParameterization,
        _parameters
      );
      if (needleIndex >= 0) {
        selectedIndices[x] = 1;
        // remove found parameterization from _parameters, as to not count duplicates
        _parameters.splice(needleIndex, 1);
      } else {
        selectedIndices[x] = 0;
      }
    }

    return selectedIndices;
  };

  const generateParameterLists = (parameters) => {
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
  };

  const generateStrategyJson = (pipeline) => {
    let strategyJSON = {};

    if (pipeline.parameters && Object.keys(pipeline.parameters).length > 0) {
      strategyJSON[context.state?.config?.PIPELINE_PARAMETERS_RESERVED_KEY] = {
        key: context.state?.config?.PIPELINE_PARAMETERS_RESERVED_KEY,
        parameters: generateParameterLists(pipeline.parameters),
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
          parameters: generateParameterLists(stepStrategy.parameters),
          title: stepStrategy.title,
        };
      }
    }

    return strategyJSON;
  };

  const onSelectSubview = (index) => {
    setState((prevState) => ({
      ...prevState,
      selectedTabIndex: index,
    }));
  };

  const handleJobNameChange = (name) => {
    setState((prevState) => ({
      ...prevState,
      job: { ...prevState.job, name: name },
    }));
  };

  const generateWithStrategy = (strategyJSON) => {
    // flatten and JSONify strategyJSON to prep data structure for algo
    let flatParameters = {};

    for (const strategyJSONKey in strategyJSON) {
      for (const paramKey in strategyJSON[strategyJSONKey].parameters) {
        let fullParam = strategyJSONKey + "#" + paramKey;

        flatParameters[fullParam] = JSON.parse(
          strategyJSON[strategyJSONKey].parameters[paramKey]
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

    let generatedPipelineRuns = [];

    recursivelyGenerate(flatParameters, generatedPipelineRuns, []);

    // transform pipelineRuns for generatedPipelineRunRows DataTable format
    let generatedPipelineRunRows = [];

    for (let idx in generatedPipelineRuns) {
      let params = generatedPipelineRuns[idx];

      let pipelineRunRow = [];

      for (let fullParam in params) {
        let paramName = fullParam.split("#").slice(1).join("");
        pipelineRunRow.push(
          paramName + ": " + JSON.stringify(params[fullParam])
        );
      }
      if (pipelineRunRow.length > 0) {
        generatedPipelineRunRows.push([pipelineRunRow.join(", ")]);
      } else {
        generatedPipelineRunRows.push([<i>Parameterless run</i>]);
      }
    }

    let selectedIndices = Array(generatedPipelineRunRows.length).fill(1);

    return [generatedPipelineRuns, generatedPipelineRunRows, selectedIndices];
  };

  const validateJobConfig = () => {
    // At least one selected pipeline run.
    if (state.selectedIndices.reduce((acc, val) => acc + val, 0) == 0) {
      return {
        pass: false,
        selectView: 3,
        reason:
          "You selected 0 pipeline runs. Please choose at least one pipeline run configuration.",
      };
    }

    // Valid cron string.
    try {
      parser.parseExpression(state.cronString);
    } catch (err) {
      return {
        pass: false,
        selectView: 0,
        reason: "Invalid cron schedule: " + state.cronString,
      };
    }

    // Valid environment variables
    for (let envPair of state.envVariables) {
      if (!isValidEnvironmentVariableName(envPair.name)) {
        return {
          pass: false,
          selectView: 2,
          reason: 'Invalid environment variable name: "' + envPair.name + '"',
        };
      }
    }

    return { pass: true };
  };

  const attemptRunJob = () => {
    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      runJob();
    } else {
      orchest.alert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        onSelectSubview(validation.selectView);
      }
    }
  };

  const runJob = () => {
    setState((prevState) => ({
      ...prevState,
      runJobLoading: true,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: false,
    });

    let envVariables = envVariablesArrayToDict(state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      setState((prevState) => ({
        ...prevState,
        runJobLoading: false,
      }));
      onSelectSubview(1);
      return;
    }

    let jobPUTData = {
      confirm_draft: true,
      strategy_json: state.strategyJSON,
      parameters: generateJobParameters(
        state.generatedPipelineRuns,
        state.selectedIndices
      ),
      env_variables: envVariables,
    };

    if (state.scheduleOption === "scheduled") {
      let formValueScheduledStart = refManager.refs.scheduledDateTime.getISOString();

      // API doesn't accept ISO date strings with 'Z' suffix
      // Instead, endpoint assumes its passed a UTC datetime string.
      if (formValueScheduledStart[formValueScheduledStart.length - 1] === "Z") {
        formValueScheduledStart = formValueScheduledStart.slice(
          0,
          formValueScheduledStart.length - 1
        );
      }

      // @ts-ignore
      jobPUTData.next_scheduled_time = formValueScheduledStart;
    } else if (state.scheduleOption === "cron") {
      // @ts-ignore
      jobPUTData.cron_schedule = state.cronString;
    }
    // Else: both entries are undefined, the run is considered to be
    // started ASAP.

    // Update orchest-api through PUT.
    // Note: confirm_draft will trigger the start the job.
    let putJobPromise = makeCancelable(
      makeRequest("PUT", "/catch/api-proxy/api/jobs/" + state.job.uuid, {
        type: "json",
        content: jobPUTData,
      }),
      promiseManager
    );

    putJobPromise.promise
      .then(() => {
        setState((prevState) => ({
          ...prevState,
          runJobCompleted: true,
        }));

        context.dispatch({
          type: "setUnsavedChanges",
          payload: false,
        });
      })
      .catch((response) => {
        if (!response.isCanceled) {
          try {
            let result = JSON.parse(response.body);
            orchest.alert("Error", "Failed to start job. " + result.message);
            setState((prevState) => ({
              ...prevState,
              runJobCompleted: true,
            }));

            context.dispatch({
              type: "setUnsavedChanges",
              payload: false,
            });
          } catch (error) {
            console.log("error");
          }
        }
      });
  };

  const putJobChanges = () => {
    /* This function should only be called
     *  for jobs with a cron schedule. As those
     *  are the only ones that are allowed to be changed
     *  when they are not a draft.
     */

    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      let jobParameters = generateJobParameters(
        state.generatedPipelineRuns,
        state.selectedIndices
      );

      let cronSchedule = state.cronString;
      let envVariables = envVariablesArrayToDict(state.envVariables);
      // Do not go through if env variables are not correctly defined.
      if (envVariables === undefined) {
        onSelectSubview(2);
        return;
      }

      // saving changes
      setState((prevState) => ({
        ...prevState,
      }));

      context.dispatch({
        type: "setUnsavedChanges",
        payload: false,
      });

      let putJobRequest = makeCancelable(
        makeRequest("PUT", `/catch/api-proxy/api/jobs/${state.job.uuid}`, {
          type: "json",
          content: {
            name: state.job.name,
            cron_schedule: cronSchedule,
            parameters: jobParameters,
            strategy_json: state.strategyJSON,
            env_variables: envVariables,
          },
        }),
        promiseManager
      );

      putJobRequest.promise
        .then(() => {
          history.push(
            generatePathFromRoute(siteMap.job.path, {
              projectId: state.job.project_uuid,
              jobId: state.job.uuid,
            })
          );
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      orchest.alert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        onSelectSubview(validation.selectView);
      }
    }
  };

  const generateJobParameters = (generatedPipelineRuns, selectedIndices) => {
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
  };

  const cancel = () => {
    history.push(
      generatePathFromRoute(siteMap.jobs.path, {
        projectId: state.job.project_uuid,
      })
    );
  };

  const onPipelineRunsSelectionChanged = (selectedRows, rows) => {
    // map selectedRows to selectedIndices
    let selectedIndices = state.selectedIndices;

    // for indexOf to work on arrays in generatedPipelineRuns it
    // depends on the object (array object) being the same (same reference!)
    for (let x = 0; x < rows.length; x++) {
      let index = state.generatedPipelineRunRows.indexOf(rows[x]);

      if (index === -1) {
        console.error("row should always be in generatedPipelineRunRows");
      }

      if (selectedRows.indexOf(rows[x]) !== -1) {
        selectedIndices[index] = 1;
      } else {
        selectedIndices[index] = 0;
      }
    }

    setState((prevState) => ({
      ...prevState,
      selectedIndices: selectedIndices,
    }));

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const parameterValueOverride = (strategyJSON, parameters) => {
    for (let key in parameters) {
      let splitKey = key.split("#");
      let strategyJSONKey = splitKey[0];
      let paramKey = splitKey.slice(1).join("#");
      let paramValue = parameters[key];

      strategyJSON[strategyJSONKey]["parameters"][paramKey] = paramValue;
    }

    return strategyJSON;
  };

  const setCronSchedule = (cronString) => {
    setState((prevState) => ({
      ...prevState,
      cronString: cronString,
      scheduleOption: "cron",
    }));

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const addEnvVariablePair = (e) => {
    e.preventDefault();

    const envVariables = state.envVariables.slice();
    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables.concat([
        {
          name: null,
          value: null,
        },
      ]),
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const onEnvVariablesChange = (value, idx, type) => {
    const envVariables = state.envVariables.slice();
    envVariables[idx][type] = value;

    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const onEnvVariablesDeletion = (idx) => {
    const envVariables = state.envVariables.slice();
    envVariables.splice(idx, 1);
    setState((prevState) => ({
      ...prevState,
      envVariables: envVariables,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const detailRows = (pipelineParameters, strategyJSON) => {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineParameters.length; x++) {
      let parameters = pipelineParameters[x];
      strategyJSON = _.cloneDeep(strategyJSON);
      strategyJSON = parameterValueOverride(strategyJSON, parameters);

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree
            pipelineName={state.pipeline.name}
            strategyJSON={strategyJSON}
          />
        </div>
      );
    }

    return detailElements;
  };

  React.useEffect(() => {
    fetchJob();
  }, []);

  React.useEffect(() => {
    if (
      state.shouldFetchPipeline &&
      state.job?.pipeline_uuid &&
      state.job?.project_uuid &&
      state.job?.uuid
    ) {
      fetchPipeline();
      setState((prevState) => ({ ...prevState, shouldFetchPipeline: false }));
    }
  }, [state.shouldFetchPipeline, state.job]);

  React.useEffect(() => {
    if (state.runJobCompleted) {
      setState((prevState) => ({ ...prevState, runJobCompleted: false }));
      history.push(
        generatePathFromRoute(siteMap.jobs.path, {
          projectId: state.job.project_uuid,
        })
      );
    }
  }, [state.runJobCompleted]);

  return (
    <Layout>
      <div className="view-page job-view">
        <h2>Edit job</h2>
        {state.job && state.pipeline ? (
          <React.Fragment>
            <div className="columns">
              <div className="column">
                <MDCTextFieldReact
                  label="Job name"
                  value={state.job.name}
                  onChange={handleJobNameChange}
                />
              </div>
              <div className="column">
                <p>Pipeline</p>
                <span className="largeText">{state.pipeline.name}</span>
              </div>
            </div>

            <MDCTabBarReact
              selectedIndex={state.selectedTabIndex}
              ref={refManager.nrefs.tabBar}
              items={[
                "Scheduling",
                "Parameters",
                "Environment variables",
                "Pipeline runs (" +
                  state.selectedIndices.reduce((total, num) => total + num, 0) +
                  "/" +
                  state.generatedPipelineRuns.length +
                  ")",
              ]}
              icons={["schedule", "tune", "view_comfy", "list"]}
              onChange={onSelectSubview}
              data-test-id="job-edit"
            />

            <div className="tab-view">
              {
                {
                  0: (
                    <div className="tab-view">
                      {state.job.status === "DRAFT" && (
                        <div>
                          <div className="push-down">
                            <MDCRadioReact
                              label="Now"
                              value="now"
                              name="time"
                              checked={state.scheduleOption === "now"}
                              onChange={(e) => {
                                setState((prevState) => ({
                                  ...prevState,
                                  scheduleOption: "now",
                                }));
                              }}
                              data-test-id="job-edit-schedule-now"
                            />
                          </div>
                          <div className="push-down">
                            <MDCRadioReact
                              label="Scheduled"
                              value="scheduled"
                              name="time"
                              checked={state.scheduleOption === "scheduled"}
                              onChange={(e) => {
                                setState((prevState) => ({
                                  ...prevState,
                                  scheduleOption: "scheduled",
                                }));
                              }}
                              data-test-id="job-edit-schedule-date"
                            />
                          </div>
                          <div>
                            <DateTimeInput
                              disabled={state.scheduleOption !== "scheduled"}
                              ref={refManager.nrefs.scheduledDateTime}
                              onFocus={() =>
                                setState((prevState) => ({
                                  ...prevState,
                                  scheduleOption: "scheduled",
                                }))
                              }
                              data-test-id="job-edit-schedule-date-input"
                            />
                          </div>
                        </div>
                      )}

                      {state.job.status === "DRAFT" && (
                        <div className="push-down">
                          <MDCRadioReact
                            label="Cron job"
                            value="cron"
                            name="time"
                            checked={state.scheduleOption === "cron"}
                            onChange={(e) => {
                              setState((prevState) => ({
                                ...prevState,
                                scheduleOption: "cron",
                              }));
                            }}
                            data-test-id="job-edit-schedule-cronjob"
                          />
                        </div>
                      )}

                      <div>
                        <CronScheduleInput
                          cronString={state.cronString}
                          onChange={setCronSchedule}
                          disabled={state.scheduleOption !== "cron"}
                          dataTestId="job-edit-schedule-cronjob-input"
                        />
                      </div>
                    </div>
                  ),
                  1: (
                    <div className="tab-view">
                      <ParameterEditor
                        pipelineName={state.pipeline.name}
                        onParameterChange={(strategyJSON) => {
                          let [
                            generatedPipelineRuns,
                            generatedPipelineRunRows,
                            selectedIndices,
                          ] = generateWithStrategy(strategyJSON);
                          setState((prevState) => ({
                            ...prevState,
                            strategyJSON,
                            generatedPipelineRuns,
                            generatedPipelineRunRows,
                            selectedIndices,
                          }));
                          context.dispatch({
                            type: "setUnsavedChanges",
                            payload: true,
                          });
                        }}
                        strategyJSON={_.cloneDeep(state.strategyJSON)}
                        data-test-id="job-edit"
                      />
                    </div>
                  ),
                  2: (
                    <div className="tab-view">
                      <p className="push-down">
                        Override any project or pipeline environment variables
                        here.
                      </p>
                      <EnvVarList
                        value={state.envVariables}
                        onAdd={addEnvVariablePair}
                        onChange={(e, idx, type) =>
                          onEnvVariablesChange(e, idx, type)
                        }
                        onDelete={(idx) => onEnvVariablesDeletion(idx)}
                        data-test-id="job-edit"
                      />
                    </div>
                  ),
                  3: (
                    <div className="pipeline-tab-view pipeline-runs">
                      <SearchableTable
                        selectable={true}
                        headers={["Run specification"]}
                        detailRows={detailRows(
                          state.generatedPipelineRuns,
                          state.strategyJSON
                        )}
                        rows={state.generatedPipelineRunRows}
                        selectedIndices={state.selectedIndices}
                        onSelectionChanged={onPipelineRunsSelectionChanged}
                        data-test-id="job-edit-pipeline-runs"
                      />
                    </div>
                  ),
                }[state.selectedTabIndex]
              }
            </div>

            <div className="buttons">
              {state.job.status === "DRAFT" && (
                <MDCButtonReact
                  disabled={state.runJobLoading}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={attemptRunJob}
                  icon="play_arrow"
                  label="Run job"
                  data-test-id="job-run"
                />
              )}
              {state.job.status !== "DRAFT" && (
                <MDCButtonReact
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={putJobChanges}
                  icon="save"
                  label="Update job"
                  data-test-id="job-update"
                />
              )}
              <MDCButtonReact
                onClick={cancel}
                label="Cancel"
                icon="close"
                data-test-id="update-job"
              />
            </div>
          </React.Fragment>
        ) : (
          <MDCLinearProgressReact />
        )}
      </div>
    </Layout>
  );
};

export default EditJobView;
