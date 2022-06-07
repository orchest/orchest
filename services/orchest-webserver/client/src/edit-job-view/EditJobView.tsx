import { BackButton } from "@/components/common/BackButton";
import { Code } from "@/components/common/Code";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import CronScheduleInput from "@/components/CronScheduleInput";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import DateTimeInput from "@/components/DateTimeInput";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchProjectSnapshotSize } from "@/hooks/useFetchProjectSnapshotSize";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { JobDocLink } from "@/job-view/JobDocLink";
import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { siteMap } from "@/routingConfig";
import type { Json, PipelineJson, StrategyJson } from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  generateStrategyJson,
  isValidEnvironmentVariableName,
  pipelinePathToJsonLocation,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ListIcon from "@mui/icons-material/List";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TuneIcon from "@mui/icons-material/Tune";
import UploadIcon from "@mui/icons-material/Upload";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { fetcher, HEADER, uuidv4 } from "@orchest/lib-utils";
import parser from "cron-parser";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import {
  flattenStrategyJson,
  generatePipelineRunParamCombinations,
  generatePipelineRunRows,
} from "./commons";
import { LoadParametersDialog } from "./LoadParametersDialog";
import { useAutoCleanUpEnabled } from "./useAutoCleanUpEnabled";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

const DEFAULT_CRON_STRING = "* * * * *";

type ScheduleOption = "now" | "cron" | "scheduled";

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
  parameterization: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
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
): string[] => {
  let _parameters = cloneDeep(parameters);
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

type PipelineRunRow = { uuid: string; spec: string; details: React.ReactNode };

const generatePipelineRuns = (
  strategyJSON: Record<string, { parameters: Record<string, string> }>
) => {
  // flatten and JSONify strategyJSON to prep data structure for later
  const flatParameters = flattenStrategyJson(strategyJSON);
  const pipelineRuns: Record<
    string,
    Json
  >[] = generatePipelineRunParamCombinations(flatParameters, [], []);

  return pipelineRuns;
};

const columns: DataTableColumn<PipelineRunRow>[] = [
  {
    id: "spec",
    label: "Run specification",
    render: function RunSpec(row) {
      return row.spec === "Parameterless run" ? <i>{row.spec}</i> : row.spec;
    },
  },
];

const generateStrategyJsonFromParamJsonFile = (
  paramJson,
  pipeline: PipelineJson,
  reservedKey: string
) => {
  let strategyJson = cloneDeep(paramJson);

  const toStringifiedParams = (params, wrap?) => {
    // Note, this function expects a modifiable object.
    // cloneDeep before invoke is recommended.
    Object.keys(params).forEach((paramKey) => {
      params[paramKey] = JSON.stringify(
        wrap ? [params[paramKey]] : params[paramKey]
      );
    });
    return params;
  };

  Object.keys(strategyJson).forEach((key) => {
    let stringifiedParams = toStringifiedParams(cloneDeep(strategyJson[key]));

    strategyJson[key] = {};
    strategyJson[key]["parameters"] = stringifiedParams;
    strategyJson[key]["key"] = key;

    // Handle reservedKey separately for title
    if (key == reservedKey) {
      try {
        strategyJson[reservedKey]["title"] = pipeline.name;
      } catch (error) {
        console.error(error);
      }
    } else {
      try {
        strategyJson[key]["title"] = pipeline.steps[key].title;
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Fill in missing values
  Object.keys(pipeline.steps).forEach((stepUuid) => {
    let step = pipeline.steps[stepUuid];
    if (
      strategyJson[stepUuid] === undefined &&
      step.parameters &&
      Object.keys(step.parameters).length > 0
    ) {
      strategyJson[stepUuid] = {
        key: stepUuid,
        title: step.title,
        parameters: toStringifiedParams(cloneDeep(step.parameters), true),
      };
    }
  });

  // Check for missing pipeline parameters
  if (strategyJson[reservedKey] === undefined) {
    strategyJson[reservedKey] = {
      key: reservedKey,
      title: pipeline.name,
      parameters: toStringifiedParams(
        pipeline.parameters ? cloneDeep(pipeline.parameters) : {},
        true
      ),
    };
  }

  return strategyJson;
};

type JobUpdatePayload = {
  name: string;
  confirm_draft: boolean;
  strategy_json: StrategyJson | undefined;
  parameters: Record<string, Json>[];
  env_variables: Record<string, unknown>;
  max_retained_pipeline_runs: number;
  next_scheduled_time?: string;
  cron_schedule?: string;
};

const EditJobView: React.FC = () => {
  // global states
  const { config, setAlert, setAsSaved } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.editJob.path });

  // data from route
  const { projectUuid, jobUuid, navigateTo } = useCustomRoute();

  // local states
  const [cronString, setCronString] = React.useState("");
  const [scheduledDateTime, setScheduledDateTime] = React.useState<Date>(
    new Date(new Date().getTime() + 60000)
  );
  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "now"
  );

  const [
    isLoadParametersDialogOpen,
    setIsLoadParametersDialogOpen,
  ] = React.useState<boolean>(false);

  const [envVariables, _setEnvVariables] = React.useState<
    EnvVarPair[] | undefined
  >([]);
  const setEnvVariables = (
    value: React.SetStateAction<EnvVarPair[] | undefined>
  ) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  const [tabIndex, setTabIndex] = React.useState(0);

  const [pipelineRunRows, setPipelineRunRows] = React.useState<
    PipelineRunRow[]
  >([]);
  const [pipelineRuns, setPipelineRuns] = React.useState<
    Record<string, Json>[]
  >([]);
  const [parameterHash, setParameterHash] = React.useState(uuidv4());
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);

  const [runJobLoading, setRunJobLoading] = React.useState(false);
  const [searchedParamFile, setSearchedParamFile] = React.useState(false);

  const { setJob, job, isFetchingJob } = useFetchJob({ jobUuid });

  const { pipelineJson, isFetchingPipelineJson } = useFetchPipelineJson(
    projectUuid && job
      ? {
          jobUuid: job.uuid,
          pipelineUuid: job.pipeline_uuid,
          projectUuid,
        }
      : undefined
  );

  const projectSnapshotSize = useFetchProjectSnapshotSize(projectUuid);

  const isLoading = isFetchingJob || isFetchingPipelineJson;

  const [strategyJson, setStrategyJson] = React.useState<
    StrategyJson | undefined
  >(undefined);

  const setNewStrategyJson = (
    strategyJson: StrategyJson | undefined,
    pipelineJson: PipelineJson | undefined,
    skipUnmount?: boolean,
    selectedIndices?: string[] | undefined
  ) => {
    // This function has some side effects to update
    // pipelineRuns
    // pipelineRunRows
    // and it optionally force re-mounts the controlled
    // component ParameterEditor
    if (!strategyJson) {
      return;
    }
    if (!pipelineJson) {
      return;
    }

    const newPipelineRuns = generatePipelineRuns(strategyJson);
    const newPipelineRunRows = generatePipelineRunRows(
      pipelineJson.name,
      newPipelineRuns
    );

    setStrategyJson(strategyJson);
    setPipelineRuns(newPipelineRuns);
    setPipelineRunRows(newPipelineRunRows);
    setSelectedRuns(
      selectedIndices
        ? selectedIndices
        : newPipelineRunRows.map((row) => row.uuid)
    );

    if (skipUnmount !== true) {
      setParameterHash(uuidv4());
    }
  };

  const [loadedStrategyJsonText, setLoadedStrategyJsonText] = React.useState<
    React.ReactElement | undefined
  >();

  React.useEffect(() => {
    if (job) {
      _setEnvVariables(envVariablesDictToArray(job.env_variables));
      setScheduleOption(!job.schedule ? "now" : "cron");
      setCronString(job.schedule || DEFAULT_CRON_STRING);
      setStrategyJson(
        job.status !== "DRAFT" ? job.strategy_json : strategyJson
      );
      if (job.status === "DRAFT") {
        setAsSaved(false);
      }
    }
  }, [job, strategyJson, pipelineJson, setAsSaved]);

  const getParamConfig = async (
    paramPath,
    pipelineUuid,
    projectUuid,
    jobUuid
  ) => {
    return await fetcher(
      `${FILE_MANAGEMENT_ENDPOINT}/read?${queryArgs({
        pipeline_uuid: pipelineUuid,
        project_uuid: projectUuid,
        job_uuid: jobUuid,
        path: paramPath,
      })}`,
      { method: "GET" }
    );
  };

  const setParamConfigByFile = (
    paramConfigPath,
    pipelineUuid,
    projectUuid,
    jobUuid,
    pipelineJson,
    reservedKey
  ) => {
    return new Promise<void>((resolve, reject) => {
      getParamConfig(paramConfigPath, pipelineUuid, projectUuid, jobUuid)
        .then((paramConfig) => {
          let strategyJson = generateStrategyJsonFromParamJsonFile(
            paramConfig,
            pipelineJson,
            reservedKey
          );
          setNewStrategyJson(strategyJson, pipelineJson);
          setLoadedStrategyJsonText(
            <p>
              Loaded parameter file <Code>{paramConfigPath}</Code>
            </p>
          );

          resolve();
        })
        .catch((e) => {
          // Default param file isn't always available, catch 404
          // without generating an error.
          if (e.status != 404) {
            console.error(e);
          }
          reject();
        });
    });
  };

  React.useEffect(() => {
    /*
      Trigger parameter config file load.
    */
    if (
      job &&
      projectUuid &&
      pipelineJson &&
      config?.PIPELINE_PARAMETERS_RESERVED_KEY &&
      !searchedParamFile
    ) {
      setSearchedParamFile(true);
      let paramConfigPath = pipelinePathToJsonLocation(
        job.pipeline_run_spec.run_config.pipeline_path
      );
      if (paramConfigPath && job.status === "DRAFT") {
        setParamConfigByFile(
          paramConfigPath,
          pipelineJson.uuid,
          projectUuid,
          job.uuid,
          job.pipeline_definition,
          config?.PIPELINE_PARAMETERS_RESERVED_KEY
        ).catch(() => {
          loadDefaultOrExistingParameterStrategy(pipelineJson, job);
        });
      } else {
        loadDefaultOrExistingParameterStrategy(pipelineJson, job);
      }
    }
  }, [job, config, pipelineJson, searchedParamFile, setParamConfigByFile]);

  const loadDefaultOrExistingParameterStrategy = (pipelineJson, job) => {
    // Do not generate another strategy_json if it has been defined
    // already.
    const reserveKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY || "";
    const strategyJson =
      job.status === "DRAFT" && Object.keys(job.strategy_json).length === 0
        ? generateStrategyJson(pipelineJson, reserveKey)
        : job.strategy_json;

    const newPipelineRuns = generatePipelineRuns(strategyJson);

    setNewStrategyJson(
      strategyJson,
      pipelineJson,
      false,
      job.parameters.length > 0
        ? parseParameters(job.parameters, newPipelineRuns)
        : undefined
    );
  };

  React.useEffect(() => {
    if (job && pipelineJson) {
    }
  }, [job, pipelineJson, config?.PIPELINE_PARAMETERS_RESERVED_KEY]);

  const handleJobNameChange = (name: string) => {
    setJob((prev) => (prev ? { ...prev, name } : prev));
    setAsSaved(false);
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
    for (let envPair of envVariables || []) {
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

  const attemptRunJob = (e: React.MouseEvent) => {
    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      runJob(e);
    } else {
      setAlert("Error", validation.reason || "Invalid job configuration");
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
      }
    }
  };

  const { run, error: putJobError } = useAsync<void>();

  React.useEffect(() => {
    if (putJobError) {
      setAlert("Error", `Failed to modify job. ${putJobError.message}`);
    }
  }, [putJobError, setAlert]);

  const {
    isAutoCleanUpEnabled,
    numberOfRetainedRuns,
    onChangeNumberOfRetainedRuns,
    toggleIsAutoCleanUpEnabled,
  } = useAutoCleanUpEnabled(
    job?.max_retained_pipeline_runs || -1,
    selectedRuns
  );

  const runJob = async (e: React.MouseEvent) => {
    if (!job) return;

    setRunJobLoading(true);
    setAsSaved();

    let updatedEnvVariables = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (updatedEnvVariables.status === "rejected") {
      setAlert("Error", updatedEnvVariables.error);
      setRunJobLoading(false);
      setTabIndex(1);
      return;
    }

    let jobPUTData: JobUpdatePayload = {
      name: job.name,
      confirm_draft: true,
      strategy_json: strategyJson,
      parameters: generateJobParameters(pipelineRuns, selectedRuns),
      env_variables: updatedEnvVariables.value,
      max_retained_pipeline_runs: isAutoCleanUpEnabled
        ? numberOfRetainedRuns
        : -1,
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

      jobPUTData.next_scheduled_time = formValueScheduledStart;
    } else if (scheduleOption === "cron") {
      jobPUTData.cron_schedule = cronString;
    }
    // Else: both entries are undefined, the run is considered to be
    // started ASAP.

    // Update orchest-api through PUT.
    // Note: confirm_draft will trigger the start the job.

    run(
      fetcher<void>(`/catch/api-proxy/api/jobs/${job.uuid}`, {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify(jobPUTData),
      }).finally(() => {
        setAsSaved();
        if (projectUuid)
          navigateTo(siteMap.jobs.path, { query: { projectUuid } }, e);
      })
    );
  };

  const showLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(true);
  };

  const closeLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(false);
  };

  const handleLoadParameters = (value) => {
    if (!job || !config || !pipelineJson) {
      return;
    }
    setParamConfigByFile(
      value,
      pipelineJson.uuid,
      projectUuid,
      job.uuid,
      job.pipeline_definition,
      config?.PIPELINE_PARAMETERS_RESERVED_KEY
    );
    closeLoadParametersDialog();
  };

  const putJobChanges = (e: React.MouseEvent) => {
    if (!job || !projectUuid) return;
    /* This function should only be called
     *  for jobs with a cron schedule. As those
     *  are the only ones that are allowed to be changed
     *  when they are not a draft.
     */

    // validate job configuration
    let validation = validateJobConfig();
    if (validation.pass === true) {
      let jobParameters = generateJobParameters(pipelineRuns, selectedRuns);

      let updatedEnvVariables = envVariablesArrayToDict(envVariables);
      // Do not go through if env variables are not correctly defined.
      if (updatedEnvVariables.status === "rejected") {
        setAlert("Error", updatedEnvVariables.error);
        setTabIndex(2);
        return;
      }

      setAsSaved();

      run(
        fetcher(`/catch/api-proxy/api/jobs/${job.uuid}`, {
          method: "PUT",
          headers: HEADER.JSON,
          body: JSON.stringify({
            name: job.name,
            cron_schedule: cronString,
            parameters: jobParameters,
            strategy_json: strategyJson,
            env_variables: updatedEnvVariables.value,
            max_retained_pipeline_runs: isAutoCleanUpEnabled
              ? numberOfRetainedRuns
              : -1,
          }),
        }).then(() => {
          navigateTo(
            siteMap.job.path,
            { query: { projectUuid, jobUuid: job.uuid } },
            e
          );
        })
      );
    } else {
      setAlert("Error", validation.reason || "Invalid job configuration");
      if (validation.selectView !== undefined) {
        setTabIndex(validation.selectView);
      }
    }
  };

  const cancel = (e: React.MouseEvent) => {
    if (projectUuid)
      navigateTo(siteMap.jobs.path, { query: { projectUuid } }, e);
  };

  const setCronSchedule = (newCronString: string) => {
    setCronString(newCronString);
    setScheduleOption("cron");
    setAsSaved(false);
  };

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
        label: `Pipeline runs (${selectedRuns.length}/${pipelineRuns.length})`,
        icon: <ListIcon />,
      },
    ];
  }, [selectedRuns, pipelineRuns.length]);

  return (
    <Layout
      toolbarElements={<BackButton onClick={cancel}>Back to jobs</BackButton>}
    >
      {job && (
        <LoadParametersDialog
          isOpen={isLoadParametersDialogOpen}
          onClose={closeLoadParametersDialog}
          onSubmit={handleLoadParameters}
          pipelineUuid={job.pipeline_uuid}
        />
      )}
      <Stack direction="column" sx={{ height: "100%" }}>
        <Typography variant="h5">Edit job</Typography>
        {job && pipelineJson ? (
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
                  required
                  autoFocus
                  label="Job name"
                  value={job.name}
                  sx={{ width: "50%" }}
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
                <Typography>{pipelineJson.name}</Typography>
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
                      label="Later"
                      data-test-id="job-edit-schedule-date"
                    />
                    <FormControlLabel
                      value="cron"
                      control={<Radio />}
                      label="Recurring"
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
                <>
                  <CronScheduleInput
                    value={cronString}
                    onChange={setCronSchedule}
                    disabled={scheduleOption !== "cron"}
                    dataTestId="job-edit-schedule-cronjob-input"
                  />
                  {projectSnapshotSize > 50 && (
                    <Alert
                      severity="warning"
                      sx={{
                        marginTop: (theme) => theme.spacing(3),
                        width: "500px",
                      }}
                    >
                      {`Snapshot size exceeds 50MB. You might want to enable `}
                      <Link
                        sx={{ cursor: "pointer" }}
                        onClick={() => setTabIndex(3)}
                      >
                        Auto Clean-up
                      </Link>
                      {` to free up disk space regularly. Check the `}
                      <JobDocLink />
                      {` for more details.`}
                    </Alert>
                  )}
                </>
              )}
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={1} name="parameters">
              <ParameterEditor
                pipelineName={pipelineJson.name}
                key={parameterHash}
                onParameterChange={(value: StrategyJson) => {
                  setNewStrategyJson(value, pipelineJson, true);
                  setAsSaved(false);
                }}
                strategyJSON={strategyJson}
                data-test-id="job-edit"
              />
              <Box sx={{ marginTop: 2 }}>
                <Button
                  variant="contained"
                  onClick={showLoadParametersDialog}
                  onAuxClick={showLoadParametersDialog}
                  startIcon={<UploadIcon />}
                >
                  Load parameters
                </Button>
                {loadedStrategyJsonText && (
                  <Box sx={{ marginTop: 2 }}>
                    <p>{loadedStrategyJsonText}</p>
                  </Box>
                )}
                <Box sx={{ marginTop: 2 }}>
                  You can generate this file in the{" "}
                  <Link
                    sx={{ cursor: "pointer" }}
                    onClick={() => {
                      navigateTo(siteMap.pipelineSettings.path, {
                        query: { projectUuid, pipelineUuid: job.pipeline_uuid },
                      });
                    }}
                  >
                    pipeline settings
                  </Link>
                  .
                </Box>
              </Box>
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={2} name="env-variables">
              <p className="push-down">
                Override any project or pipeline environment variables here.
              </p>
              <EnvVarList
                value={envVariables || []}
                setValue={setEnvVariables}
                data-test-id="job-edit"
              />
            </CustomTabPanel>
            <CustomTabPanel value={tabIndex} index={3} name="runs">
              <div className="pipeline-tab-view pipeline-runs">
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ margin: (theme) => theme.spacing(4, 0, 6) }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isAutoCleanUpEnabled}
                        onChange={toggleIsAutoCleanUpEnabled}
                      />
                    }
                    label={`Auto clean-up oldest pipeline runs, retain the last `}
                    sx={{ marginRight: 0 }}
                  />
                  <TextField
                    variant="standard"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          pipeline runs
                        </InputAdornment>
                      ),
                    }}
                    disabled={!isAutoCleanUpEnabled}
                    value={numberOfRetainedRuns}
                    type="number"
                    size="small"
                    onChange={(e) =>
                      onChangeNumberOfRetainedRuns(parseInt(e.target.value))
                    }
                  />
                  <Tooltip
                    placement="right"
                    title={
                      <>
                        <Typography
                          variant="body2"
                          sx={{ marginBottom: (theme) => theme.spacing(1) }}
                        >
                          Retain the last finished pipeline runs and
                          automatically remove the oldest runs. This reduces
                          disk space usage.
                        </Typography>
                        <Typography variant="body2">
                          If your pipeline produces artifacts that are stored in
                          the project directory, then you might want to backup
                          the artifacts to external sources or the{" "}
                          <Code>/data</Code> directory.
                        </Typography>
                      </>
                    }
                  >
                    <InfoOutlinedIcon
                      color="primary"
                      fontSize="small"
                      sx={{
                        marginLeft: (theme) => theme.spacing(2),
                        cursor: "pointer",
                      }}
                    />
                  </Tooltip>
                </Stack>
                <DataTable<PipelineRunRow>
                  selectable
                  id="job-edit-pipeline-runs"
                  columns={columns}
                  isLoading={isLoading}
                  initialSelectedRows={pipelineRunRows.map(
                    (pipelineRunRow) => pipelineRunRow.uuid
                  )}
                  selectedRows={selectedRuns}
                  setSelectedRows={setSelectedRuns}
                  onChangeSelection={() => setAsSaved(false)}
                  rows={pipelineRunRows}
                  retainSelectionsOnPageChange
                  data-test-id="job-edit-pipeline-runs"
                />
              </div>
            </CustomTabPanel>
            <Stack direction="row" spacing={2}>
              {job.status === "DRAFT" && (
                <Button
                  disabled={runJobLoading || !job.name}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={attemptRunJob}
                  onAuxClick={attemptRunJob}
                  data-test-id="job-run"
                >
                  Run job
                </Button>
              )}
              {job.status !== "DRAFT" && (
                <Button
                  variant="contained"
                  onClick={putJobChanges}
                  onAuxClick={putJobChanges}
                  startIcon={<SaveIcon />}
                  data-test-id="job-update"
                >
                  Update job
                </Button>
              )}
              <Button
                onClick={cancel}
                onAuxClick={cancel}
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
