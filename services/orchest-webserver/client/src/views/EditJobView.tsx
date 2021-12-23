import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import CronScheduleInput from "@/components/CronScheduleInput";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import DateTimeInput from "@/components/DateTimeInput";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import { NoParameterAlert } from "@/components/ParamTree";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Job, Json, PipelineJson, StrategyJson } from "@/types";
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
import { styled } from "@mui/material/styles";
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
import React from "react";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

type EditJobState = {
  generatedPipelineRuns: Record<string, Json>[];
  runJobLoading: boolean;
  runJobCompleted: boolean;
  strategyJSON: StrategyJson;
};

const DEFAULT_CRON_STRING = "* * * * *";

type ScheduleOption = "now" | "cron" | "scheduled";

// TODO: should be converted to map/reduce style

function recursivelyGenerate(
  params: Record<string, Record<string, Json>>,
  accum: any[],
  unpacked: any[]
) {
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
}

const generateJobParameters = (
  generatedPipelineRuns: Record<string, Json>[],
  selectedIndices: string[]
) => {
  return selectedIndices.map((index) => {
    const runParameters = generatedPipelineRuns[index];
    return Object.entries(runParameters).reduce((all, [key, value]) => {
      // key is formatted: <stepUUID>#<parameterKey>
      let keySplit = key.split("#");
      let stepUUID = keySplit[0];
      let parameterKey = keySplit.slice(1).join("#");

      // check if step already exists,
      const parameter = all[stepUUID] || {};
      parameter[parameterKey] = value;

      return { ...all, [stepUUID]: parameter };
    }, {});
  });
};

const findParameterization = (
  parameterization: Record<string, any>,
  parameters: Record<string, Json>[]
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
  parameters: Record<string, Json>[],
  generatedPipelineRuns: Record<string, Json>[]
) => {
  let _parameters = _.cloneDeep(parameters);
  let selectedIndices = new Set<string>();
  generatedPipelineRuns.forEach((run, index) => {
    let encodedParameterization = generateJobParameters([run], ["0"])[0];

    let needleIndex = findParameterization(
      encodedParameterization,
      _parameters
    );
    if (needleIndex >= 0) {
      selectedIndices.add(index.toString());
      // remove found parameterization from _parameters, as to not count duplicates
      _parameters.splice(needleIndex, 1);
    } else {
      selectedIndices.delete(index.toString());
    }
  });

  return Array.from(selectedIndices);
};

const parameterValueOverride = (
  strategyJSON: StrategyJson,
  parameters: Record<string, string>
) => {
  for (let key in parameters) {
    let splitKey = key.split("#");
    let strategyJSONKey = splitKey[0];
    let paramKey = splitKey.slice(1).join("#");
    let paramValue = parameters[key];

    strategyJSON[strategyJSONKey].parameters[paramKey] = paramValue;
  }

  return strategyJSON;
};

const generateWithStrategy = (
  pipelineName: string,
  strategyJSON: Record<string, { parameters: Record<string, string> }>
) => {
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

  let generatedPipelineRuns: Record<string, Json>[] = [];

  recursivelyGenerate(flatParameters, generatedPipelineRuns, []);

  // transform pipelineRuns for generatedPipelineRunRows DataTable format
  const generatedPipelineRunRows: PipelineRunRow[] = generatedPipelineRuns.map(
    (params: Record<string, Json>, index: number) => {
      const pipelineRunSpec = Object.entries(params).map(
        ([fullParam, value]) => {
          // pipeline_parameters#something#another_something: "some-value"
          let paramName = fullParam.split("#").slice(1).join("");
          return `${paramName}: ${JSON.stringify(value)}`;
        }
      );

      return {
        uuid: index.toString(),
        spec: pipelineRunSpec.join(", ") || "Parameterless run",
        details: (
          <Stack
            direction="column"
            alignItems="flex-start"
            sx={{ padding: (theme) => theme.spacing(2, 1) }}
          >
            {pipelineRunSpec.length === 0 ? (
              <NoParameterAlert />
            ) : (
              <>
                <Typography variant="body2">{pipelineName}</Typography>
                {pipelineRunSpec.map((param, index) => (
                  <Typography
                    variant="caption"
                    key={index}
                    sx={{ paddingLeft: (theme) => theme.spacing(1) }}
                  >
                    {param}
                  </Typography>
                ))}
              </>
            )}
          </Stack>
        ),
      };
    }
  );

  return [generatedPipelineRuns, generatedPipelineRunRows] as const;
};

type PipelineRunRow = { uuid: string; spec: string; details: React.ReactNode };
const columns: DataTableColumn<PipelineRunRow>[] = [
  {
    id: "spec",
    label: "Run specification",
    render: function RunSpec(row) {
      return row.spec === "Parameterless run" ? <i>{row.spec}</i> : row.spec;
    },
  },
];

const EditJobView: React.FC = () => {
  // global states
  const appContext = useAppContext();
  const { setAlert, setAsSaved } = appContext;
  useSendAnalyticEvent("view load", { name: siteMap.editJob.path });

  // data from route
  const { projectUuid, jobUuid, navigateTo } = useCustomRoute();

  // local states
  const [job, setJob] = React.useState<Job>();
  const [pipeline, setPipeline] = React.useState<PipelineJson>();
  const [cronString, setCronString] = React.useState("");
  const [scheduledDateTime, setScheduledDateTime] = React.useState<Date>(
    new Date(new Date().getTime() + 60000)
  );
  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "now"
  );

  const [envVariables, _setEnvVariables] = React.useState<EnvVarPair[]>([]);
  const setEnvVariables = (value: React.SetStateAction<EnvVarPair[]>) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  const [tabIndex, setTabIndex] = React.useState(0);

  const [pipelineRuns, setPipelineRuns] = React.useState<PipelineRunRow[]>([]);
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);

  const [state, setState] = React.useState<EditJobState>({
    generatedPipelineRuns: [],
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
        _setEnvVariables(envVariablesDictToArray(fetchedJob.env_variables));

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
        const fetchedPipeline: PipelineJson = JSON.parse(result.pipeline_json);

        setPipeline(fetchedPipeline);

        // Do not generate another strategy_json if it has been defined
        // already.

        const strategyJSON =
          fetchedJob.status === "DRAFT" &&
          Object.keys(fetchedJob.strategy_json).length === 0
            ? generateStrategyJson(fetchedPipeline)
            : fetchedJob.strategy_json;

        const [
          generatedPipelineRuns,
          generatedPipelineRunRows,
        ] = generateWithStrategy(fetchedPipeline?.name, strategyJSON);

        setPipelineRuns(generatedPipelineRunRows);

        // Account for the fact that a job might have a list of
        // parameters already defined, i.e. when editing a non draft
        // job or when duplicating a job.
        // if fetchedJob has no set parameters, we select all parameters as default
        setSelectedRuns(
          fetchedJob.parameters.length > 0
            ? parseParameters(fetchedJob.parameters, generatedPipelineRuns)
            : generatedPipelineRunRows.map((run) => run.uuid)
        );

        setState((prevState) => ({
          ...prevState,
          strategyJSON,
          generatedPipelineRuns,
        }));
      } else {
        console.warn("Could not load pipeline.json");
      }
    });
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

  const validateJobConfig = () => {
    // At least one selected pipeline run.
    if (selectedRuns.length === 0) {
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
        selectedRuns
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
        selectedRuns
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

  const cancel = () => {
    if (projectUuid)
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid },
      });
  };

  const setCronSchedule = (newCronString: string) => {
    setCronString(newCronString);
    setScheduleOption("cron");
    setAsSaved(false);
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
        id: "scheduling",
        label: "Scheduling",
        icon: <ScheduleIcon />,
      },
      {
        id: "parameters",
        label: "Parameters",
        icon: <TuneIcon />,
      },
      {
        id: "environment-variables",
        label: "Environment variables",
        icon: <ViewComfyIcon />,
      },
      {
        id: "runs",
        label: `Pipeline runs (${selectedRuns.length}/${state.generatedPipelineRuns.length})`,
        icon: <ListIcon />,
      },
    ];
  }, [selectedRuns, state.generatedPipelineRuns.length]);

  return (
    <Layout fullHeight>
      <Stack direction="column" sx={{ height: "100%" }}>
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
                  data-test-id={`${tab.id}-tab`}
                />
              ))}
            </Tabs>
            <CustomTabPanel value={tabIndex} index={0} name="scheduling">
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
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={1} name="parameters">
              <ParameterEditor
                pipelineName={pipeline.name}
                onParameterChange={(strategyJSON) => {
                  let [
                    generatedPipelineRuns,
                    generatedPipelineRunRows,
                  ] = generateWithStrategy(pipeline?.name, strategyJSON);

                  setPipelineRuns(generatedPipelineRunRows);
                  setSelectedRuns(
                    generatedPipelineRunRows.map((row) => row.uuid)
                  );
                  setState((prevState) => ({
                    ...prevState,
                    strategyJSON,
                    generatedPipelineRuns,
                  }));

                  setAsSaved(false);
                }}
                strategyJSON={_.cloneDeep(state.strategyJSON)}
                data-test-id="job-edit"
              />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={2} name="env-variables">
              <p className="push-down">
                Override any project or pipeline environment variables here.
              </p>
              <EnvVarList
                value={envVariables}
                setValue={setEnvVariables}
                data-test-id="job-edit"
              />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={3} name="runs">
              <div className="pipeline-tab-view pipeline-runs">
                <DataTable<PipelineRunRow>
                  selectable
                  id="job-edit-pipeline-runs"
                  columns={columns}
                  initialSelectedRows={pipelineRuns.map(
                    (pipelineRun) => pipelineRun.uuid
                  )}
                  selectedRows={selectedRuns}
                  setSelectedRows={setSelectedRuns}
                  onChangeSelection={() => setAsSaved(false)}
                  rows={pipelineRuns}
                  data-test-id="job-edit-pipeline-runs"
                />
              </div>
            </CustomTabPanel>
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
                color="secondary"
                data-test-id="update-job"
              >
                Cancel
              </Button>
            </Stack>
          </>
        ) : (
          <LinearProgress />
        )}
      </Stack>
    </Layout>
  );
};

export default EditJobView;
