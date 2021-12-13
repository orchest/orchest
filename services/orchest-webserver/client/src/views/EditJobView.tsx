import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import CronScheduleInput from "@/components/CronScheduleInput";
import DateTimeInput from "@/components/DateTimeInput";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import ParamTree from "@/components/ParamTree";
import SearchableTable from "@/components/SearchableTable";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Job, PipelineJson } from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  getPipelineJSONEndpoint,
  isValidEnvironmentVariableName,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import ListIcon from "@mui/icons-material/List";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TuneIcon from "@mui/icons-material/Tune";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import parser from "cron-parser";
import _ from "lodash";
import React, { useState } from "react";

type EditJobState = {
  generatedPipelineRuns: any[];
  generatedPipelineRunRows: any[];
  selectedIndices: number[];
  runJobLoading: boolean;
  runJobCompleted: boolean;
  strategyJSON: Record<string, any>;
};

const DEFAULT_CRON_STRING = "* * * * *";

type ScheduleOption = "now" | "cron" | "scheduled";

const EditJobView: React.FC = () => {
  // global states
  const appContext = useAppContext();
  const { setAlert, setAsSaved } = appContext;
  useSendAnalyticEvent("view load", { name: siteMap.editJob.path });

  // data from route
  const { projectUuid, jobUuid, navigateTo } = useCustomRoute();

  // local states
  const [job, setJob] = useState<Job>();
  const [pipeline, setPipeline] = useState<PipelineJson>();
  const [envVariables, setEnvVariables] = useState<
    { name: string; value: string }[]
  >([]);
  const [cronString, setCronString] = React.useState("");
  const [scheduledDateTime, setScheduledDateTime] = React.useState<Date>(
    new Date(new Date().getTime() + 60000)
  );
  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "now"
  );

  const [tabIndex, setTabIndex] = React.useState(0);

  const [state, setState] = React.useState<EditJobState>({
    generatedPipelineRuns: [],
    generatedPipelineRunRows: [],
    selectedIndices: [],
    runJobLoading: false,
    runJobCompleted: false,
    strategyJSON: {},
  });

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

        setScheduleOption(!fetchedJob.schedule ? "now" : "cron");
        setCronString(fetchedJob.schedule || DEFAULT_CRON_STRING);

        setState((prevState) => ({
          ...prevState,
          strategyJSON:
            fetchedJob.status !== "DRAFT"
              ? fetchedJob.strategy_json
              : prevState.strategyJSON,
        }));

        if (fetchedJob.status === "DRAFT") {
          setAsSaved(false);
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
      strategyJSON[
        appContext.state.config?.PIPELINE_PARAMETERS_RESERVED_KEY
      ] = {
        key: appContext.state.config?.PIPELINE_PARAMETERS_RESERVED_KEY,
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
      parser.parseExpression(cronString || "");
    } catch (err) {
      return {
        pass: false,
        selectView: 0,
        reason: "Invalid cron schedule: " + cronString,
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
      setAlert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
      }
    }
  };

  const runJob = () => {
    if (!job) return;

    setState((prevState) => ({
      ...prevState,
      runJobLoading: true,
    }));

    setAsSaved();

    let updatedEnvVariables = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (updatedEnvVariables.status === "rejected") {
      setAlert("Error", updatedEnvVariables.error);
      setState((prevState) => ({
        ...prevState,
        runJobLoading: false,
      }));
      setTabIndex(1);
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

    if (scheduleOption === "scheduled") {
      let formValueScheduledStart = scheduledDateTime.toISOString();

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
    } else if (scheduleOption === "cron") {
      // @ts-ignore
      jobPUTData.cron_schedule = cronString;
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

        setAsSaved();
      })
      .catch((response: any) => {
        if (!response.isCanceled) {
          try {
            let result = JSON.parse(response.body);
            setAlert("Error", `Failed to start job. ${result.message}`);
            setState((prevState) => ({
              ...prevState,
              runJobCompleted: true,
            }));

            setAsSaved();
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

      let updatedEnvVariables = envVariablesArrayToDict(envVariables);
      // Do not go through if env variables are not correctly defined.
      if (updatedEnvVariables.status === "rejected") {
        setAlert("Error", updatedEnvVariables.error);
        setTabIndex(2);
        return;
      }

      setAsSaved();

      let putJobRequest = makeCancelable(
        makeRequest("PUT", `/catch/api-proxy/api/jobs/${job.uuid}`, {
          type: "json",
          content: {
            name: job.name,
            cron_schedule: cronString,
            parameters: jobParameters,
            strategy_json: state.strategyJSON,
            env_variables: updatedEnvVariables.value,
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
      setAlert("Error", validation.reason);
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
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

    setAsSaved(false);
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

  const setCronSchedule = (newCronString: string) => {
    setCronString(newCronString);
    setScheduleOption("cron");
    setAsSaved(false);
  };

  const addEnvVariablePair = (e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();

    setEnvVariables((envVariables) => [
      ...envVariables,
      { name: null, value: null },
    ]);

    setAsSaved(false);
  };

  const onEnvVariablesChange = (value, idx: number, type) => {
    setEnvVariables((prev) => {
      const copiedEnvVariables = [...prev];
      copiedEnvVariables[idx][type] = value;
      return copiedEnvVariables;
    });

    setAsSaved(false);
  };

  const onEnvVariablesDeletion = (idx: number) => {
    setEnvVariables((prev) => {
      const copiedEnvVariables = [...prev];
      copiedEnvVariables.splice(idx, 1);
      return copiedEnvVariables;
    });

    setAsSaved(false);
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

  const handleChangeTab = (
    event: React.SyntheticEvent<Element, Event>,
    newValue: number
  ) => {
    setTabIndex(newValue);
  };

  const tabs = React.useMemo(() => {
    return [
      {
        id: "scheduling-tab",
        label: "Scheduling",
        icon: <ScheduleIcon />,
      },
      {
        id: "parameters-tab",
        label: "Parameters",
        icon: <TuneIcon />,
      },
      {
        id: "environment-variables-tab",
        label: "Environment variables",
        icon: <ViewComfyIcon />,
      },
      {
        id: "runs-tab",
        label: `Pipeline runs (${state.selectedIndices.reduce(
          (total, num) => total + num,
          0
        )}/${state.generatedPipelineRuns.length})`,
        icon: <ListIcon />,
      },
    ];
  }, [state.selectedIndices, state.generatedPipelineRuns.length]);

  return (
    <Layout>
      <div className="view-page job-view">
        <Typography variant="h5">Edit job</Typography>
        {job && pipeline ? (
          <>
            <Stack
              direction="row"
              flexWrap="wrap"
              sx={{ width: "100%", marginTop: (theme) => theme.spacing(4) }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: "300px",
                  marginBottom: (theme) => theme.spacing(4),
                }}
              >
                <TextField
                  variant="filled"
                  label="Job name"
                  value={job.name}
                  onChange={(e) => handleJobNameChange(e.target.value)}
                />
              </Box>
              <Stack
                direction="column"
                sx={{
                  flex: 1,
                  minWidth: "300px",
                  marginBottom: (theme) => theme.spacing(4),
                }}
              >
                <Typography variant="caption">Pipeline</Typography>
                <Typography>{pipeline.name}</Typography>
              </Stack>
            </Stack>
            <Tabs
              value={tabIndex}
              onChange={handleChangeTab}
              label="Edit Job Tabs"
              data-test-id="job-edit"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  id={tab.id}
                  label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
                  aria-controls={tab.id}
                />
              ))}
            </Tabs>
            <TabPanel
              value={tabIndex}
              index={0}
              name="scheduling"
              sx={{ padding: (theme) => theme.spacing(3, 1) }}
            >
              {job.status === "DRAFT" && (
                <FormControl
                  component="fieldset"
                  sx={{
                    marginBottom: (theme) => theme.spacing(4),
                    width: "100%",
                  }}
                >
                  <RadioGroup
                    row
                    aria-label="Scheduling"
                    defaultValue="now"
                    name="scheduling-buttons-group"
                    value={scheduleOption}
                    onChange={(e) =>
                      setScheduleOption(e.target.value as ScheduleOption)
                    }
                  >
                    <FormControlLabel
                      value="now"
                      control={<Radio />}
                      label="Now"
                      data-test-id="job-edit-schedule-now"
                    />
                    <FormControlLabel
                      value="scheduled"
                      control={<Radio />}
                      label="Scheduled"
                      data-test-id="job-edit-schedule-date"
                    />
                    <FormControlLabel
                      value="cron"
                      control={<Radio />}
                      label="Cron job"
                      data-test-id="job-edit-schedule-cronjob"
                    />
                  </RadioGroup>
                </FormControl>
              )}
              {scheduleOption === "scheduled" && (
                <DateTimeInput
                  disabled={scheduleOption !== "scheduled"}
                  value={scheduledDateTime}
                  onChange={setScheduledDateTime}
                  data-test-id="job-edit-schedule-date-input"
                />
              )}
              {scheduleOption === "cron" && (
                <CronScheduleInput
                  value={cronString}
                  onChange={setCronSchedule}
                  disabled={scheduleOption !== "cron"}
                  dataTestId="job-edit-schedule-cronjob-input"
                />
              )}
            </TabPanel>
            <TabPanel
              value={tabIndex}
              index={1}
              name="parameters"
              sx={{ padding: (theme) => theme.spacing(3, 1) }}
            >
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

                  setAsSaved(false);
                }}
                strategyJSON={_.cloneDeep(state.strategyJSON)}
                data-test-id="job-edit"
              />
            </TabPanel>
            <TabPanel
              value={tabIndex}
              index={2}
              name="env-variables"
              sx={{ padding: (theme) => theme.spacing(3, 1) }}
            >
              <p className="push-down">
                Override any project or pipeline environment variables here.
              </p>
              <EnvVarList
                value={envVariables}
                onAdd={addEnvVariablePair}
                onChange={(e, idx, type) => onEnvVariablesChange(e, idx, type)}
                onDelete={(idx) => onEnvVariablesDeletion(idx)}
                data-test-id="job-edit"
              />
            </TabPanel>
            <TabPanel
              value={tabIndex}
              index={3}
              name="runs"
              sx={{ padding: (theme) => theme.spacing(3, 1) }}
            >
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
            </TabPanel>
            <Stack direction="row" spacing={2}>
              {job.status === "DRAFT" && (
                <Button
                  disabled={state.runJobLoading}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={attemptRunJob}
                  data-test-id="job-run"
                >
                  Run job
                </Button>
              )}
              {job.status !== "DRAFT" && (
                <Button
                  variant="contained"
                  onClick={putJobChanges}
                  startIcon={<SaveIcon />}
                  data-test-id="job-update"
                >
                  Update job
                </Button>
              )}
              <Button
                onClick={cancel}
                startIcon={<CloseIcon />}
                data-test-id="update-job"
              >
                Cancel
              </Button>
            </Stack>
          </>
        ) : (
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default EditJobView;
