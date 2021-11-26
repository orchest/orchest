import CronScheduleInput from "@/components/CronScheduleInput";
import DateTimeInput from "@/components/DateTimeInput";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import ParamTree from "@/components/ParamTree";
import SearchableTable from "@/components/SearchableTable";
import { useAppContext } from "@/contexts/AppContext";
import { useOrchest } from "@/hooks/orchest";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import type { Job, PipelineJson } from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  getPipelineJSONEndpoint,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import LinearProgress from "@mui/material/LinearProgress";
import {
  MDCButtonReact,
  MDCRadioReact,
  MDCTabBarReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import parser from "cron-parser";
import _ from "lodash";
import React, { useState } from "react";

type EditJobState = {
  selectedTabIndex: number;
  generatedPipelineRuns: any[];
  generatedPipelineRunRows: any[];
  selectedIndices: number[];
  scheduleOption: "now" | "cron" | "scheduled";
  runJobLoading: boolean;
  runJobCompleted: boolean;
  cronString: string | undefined;
  strategyJSON: Record<string, any>;
};

const EditJobView: React.FC = () => {
  // global states
  const { orchest } = window;
  const context = useOrchest();
  const { setAlert } = useAppContext();

  // data from route
  const { projectUuid, jobUuid, navigateTo } = useCustomRoute();

  // local states
  const [job, setJob] = useState<Job>();
  const [pipeline, setPipeline] = useState<PipelineJson>();
  const [envVariables, setEnvVariables] = useState<
    { name: string; value: string }[]
  >([]);
  const [state, setState] = React.useState<EditJobState>({
    selectedTabIndex: 0,
    generatedPipelineRuns: [],
    generatedPipelineRunRows: [],
    selectedIndices: [],
    scheduleOption: "now",
    runJobLoading: false,
    runJobCompleted: false,
    cronString: undefined,
    strategyJSON: {},
  });

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());

  const fetchJob = () => {
    let fetchJobPromise = makeCancelable(
      makeRequest("GET", `/catch/api-proxy/api/jobs/${jobUuid}`),
      promiseManager
    );

    fetchJobPromise.promise.then((response: string) => {
      try {
        let fetchedJob: Job = JSON.parse(response);
        setJob(fetchedJob);

        if (fetchedJob.pipeline_uuid && fetchedJob.uuid) {
          fetchPipeline(fetchedJob);
        }
        setEnvVariables(envVariablesDictToArray(fetchedJob.env_variables));

        setState((prevState) => ({
          ...prevState,
          cronString: fetchedJob.schedule || "* * * * *",
          scheduleOption: fetchedJob.schedule === null ? "now" : "cron",
          strategyJSON:
            fetchedJob.status !== "DRAFT"
              ? fetchedJob.strategy_json
              : prevState.strategyJSON,
        }));

        if (fetchedJob.status === "DRAFT") {
          context.dispatch({
            type: "setUnsavedChanges",
            payload: true,
          });
        }
      } catch (error) {
        console.error(error);
      }
    });
  };

  const fetchPipeline = (fetchedJob: Job) => {
    if (!projectUuid) return;
    let fetchPipelinePromise = makeCancelable(
      makeRequest(
        "GET",
        getPipelineJSONEndpoint(
          fetchedJob.pipeline_uuid,
          projectUuid,
          fetchedJob.uuid
        )
      ),
      promiseManager
    );

    fetchPipelinePromise.promise.then((response: string) => {
      let result: {
        pipeline_json: string;
        success: boolean;
      } = JSON.parse(response);
      if (result.success) {
        let fetchedPipeline: PipelineJson = JSON.parse(result.pipeline_json);

        setPipeline(fetchedPipeline);

        // Do not generate another strategy_json if it has been defined
        // already.

        let strategyJSON =
          fetchedJob.status === "DRAFT" &&
          Object.keys(fetchedJob.strategy_json).length === 0
            ? generateStrategyJson(fetchedPipeline)
            : fetchedJob.strategy_json;

        let [
          generatedPipelineRuns,
          generatedPipelineRunRows,
          selectedIndices,
        ] = generateWithStrategy(strategyJSON);

        // Account for the fact that a job might have a list of
        // parameters already defined, i.e. when editing a non draft
        // job or when duplicating a job.
        if (fetchedJob.parameters.length > 0) {
          // Determine selection based on strategyJSON
          selectedIndices = parseParameters(
            fetchedJob.parameters,
            generatedPipelineRuns
          );
        }

        setState((prevState) => ({
          ...prevState,
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

  const findParameterization = (
    parameterization: Record<string, any>,
    parameters: Record<string, any>
  ) => {
    let JSONstring = JSON.stringify(parameterization);
    for (let x = 0; x < parameters.length; x++) {
      if (JSON.stringify(parameters[x]) === JSONstring) {
        return x;
      }
    }
    return -1;
  };

  const parseParameters = (
    parameters: Record<string, any>,
    generatedPipelineRuns: Record<string, any>
  ) => {
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

  const generateParameterLists = (parameters: Record<string, any>) => {
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

  const onSelectSubview = (index: number) => {
    setState((prevState) => ({
      ...prevState,
      selectedTabIndex: index,
    }));
  };

  const handleJobNameChange = (name: string) => {
    setJob((prev) => (prev ? { ...prev, name } : prev));
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
        generatedPipelineRunRows.push([<i>Parameterless run</i>]); // eslint-disable-line react/jsx-key
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
      parser.parseExpression(state.cronString || "");
    } catch (err) {
      return {
        pass: false,
        selectView: 0,
        reason: "Invalid cron schedule: " + state.cronString,
      };
    }

    // Valid environment variables
    for (let envPair of envVariables) {
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
      setAlert({ content: validation.reason });
      if (validation.selectView !== undefined) {
        onSelectSubview(validation.selectView);
      }
    }
  };

  const runJob = () => {
    if (!job) return;

    setState((prevState) => ({
      ...prevState,
      runJobLoading: true,
    }));
    context.dispatch({
      type: "setUnsavedChanges",
      payload: false,
    });

    let updatedEnvVariables = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (updatedEnvVariables.status === "rejected") {
      setAlert({ content: updatedEnvVariables.error });
      setState((prevState) => ({
        ...prevState,
        runJobLoading: false,
      }));
      onSelectSubview(1);
      return;
    }

    let jobPUTData = {
      name: job.name,
      confirm_draft: true,
      strategy_json: state.strategyJSON,
      parameters: generateJobParameters(
        state.generatedPipelineRuns,
        state.selectedIndices
      ),
      env_variables: updatedEnvVariables.value,
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
      makeRequest("PUT", "/catch/api-proxy/api/jobs/" + job.uuid, {
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
      .catch((response: any) => {
        if (!response.isCanceled) {
          try {
            let result = JSON.parse(response.body);
            setAlert({ content: `Failed to start job. ${result.message}` });
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
    if (!job || !projectUuid) return;
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
      let updatedEnvVariables = envVariablesArrayToDict(envVariables);
      // Do not go through if env variables are not correctly defined.
      if (updatedEnvVariables.status === "rejected") {
        setAlert({ content: updatedEnvVariables.error });
        onSelectSubview(2);
        return;
      }

      context.dispatch({
        type: "setUnsavedChanges",
        payload: false,
      });

      let putJobRequest = makeCancelable(
        makeRequest("PUT", `/catch/api-proxy/api/jobs/${job.uuid}`, {
          type: "json",
          content: {
            name: job.name,
            cron_schedule: cronSchedule,
            parameters: jobParameters,
            strategy_json: state.strategyJSON,
            env_variables: updatedEnvVariables,
          },
        }),
        promiseManager
      );

      putJobRequest.promise
        .then(() => {
          navigateTo(siteMap.job.path, {
            query: {
              projectUuid,
              jobUuid: job.uuid,
            },
          });
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      setAlert({ content: validation.reason });
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

          selectedRunParameters[stepUUID] =
            selectedRunParameters[stepUUID] || {};

          selectedRunParameters[stepUUID][parameterKey] = runParameters[key];
        }

        parameters.push(selectedRunParameters);
      }
    }

    return parameters;
  };

  const cancel = () => {
    if (projectUuid)
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid },
      });
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

      selectedIndices[index] = selectedRows.indexOf(rows[x]) !== -1 ? 1 : 0;
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

  const setCronSchedule = (cronString: string) => {
    setState((prevState) => ({
      ...prevState,
      cronString,
      scheduleOption: "cron",
    }));

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const addEnvVariablePair = (e) => {
    e.preventDefault();

    setEnvVariables((envVariables) => [
      ...envVariables,
      { name: null, value: null },
    ]);

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const onEnvVariablesChange = (value, idx: number, type) => {
    setEnvVariables((prev) => {
      const copiedEnvVariables = [...prev];
      copiedEnvVariables[idx][type] = value;
      return copiedEnvVariables;
    });

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  const onEnvVariablesDeletion = (idx: number) => {
    setEnvVariables((prev) => {
      const copiedEnvVariables = [...prev];
      copiedEnvVariables.splice(idx, 1);
      return copiedEnvVariables;
    });

    context.dispatch({
      type: "setUnsavedChanges",
      payload: true,
    });
  };

  // @ts-ignore
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
            pipelineName={pipeline?.name || ""}
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
    if (state.runJobCompleted) {
      setState((prevState) => ({ ...prevState, runJobCompleted: false }));
      if (projectUuid)
        navigateTo(siteMap.jobs.path, {
          query: { projectUuid },
        });
    }
  }, [state.runJobCompleted]);

  return (
    <Layout>
      <div className="view-page job-view">
        <h2>Edit job</h2>
        {job && pipeline ? (
          <React.Fragment>
            <div className="columns">
              <div className="column">
                <MDCTextFieldReact
                  label="Job name"
                  value={job.name}
                  onChange={handleJobNameChange}
                />
              </div>
              <div className="column">
                <p>Pipeline</p>
                <span className="largeText">{pipeline.name}</span>
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
                      {job.status === "DRAFT" && (
                        <div>
                          <div className="push-down">
                            <MDCRadioReact
                              label="Now"
                              value="now"
                              name="now"
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

                      {job.status === "DRAFT" && (
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
                        pipelineName={pipeline.name}
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
                        value={envVariables}
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
              {job.status === "DRAFT" && (
                <MDCButtonReact
                  disabled={state.runJobLoading}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={attemptRunJob}
                  icon="play_arrow"
                  label="Run job"
                  data-test-id="job-run"
                />
              )}
              {job.status !== "DRAFT" && (
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
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default EditJobView;
