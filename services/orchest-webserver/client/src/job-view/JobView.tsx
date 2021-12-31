import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { DescriptionList } from "@/components/DescriptionList";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import { NoParameterAlert } from "@/components/ParamTree";
import { StatusInline } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Job, Json, PipelineJson, PipelineRun } from "@/types";
import {
  checkGate,
  envVariablesDictToArray,
  formatServerDateTime,
  getPipelineJSONEndpoint,
} from "@/utils/webserver-utils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import ListIcon from "@mui/icons-material/List";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import {
  fetcher,
  hasValue,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import cronstrue from "cronstrue";
import React from "react";
import { JobStatus } from "./JobStatus";

const PARAMETERLESS_RUN = "Parameterless run";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

const formatPipelineParams = (parameters: Record<string, Json>) => {
  return Object.values(parameters).map((parameter) => {
    return Object.entries(parameter)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  });
};

const columns: DataTableColumn<PipelineRun>[] = [
  { id: "pipeline_run_index", label: "ID" },
  {
    id: "parameters",
    label: "Parameters",
    render: function RunParameters(row) {
      const formattedParams = formatPipelineParams(row.parameters);
      return formattedParams.length === 0 ? (
        <i>{PARAMETERLESS_RUN}</i>
      ) : (
        formattedParams.join(", ")
      );
    },
  },
  {
    id: "status",
    label: "Status",
    render: function RunStatus(row) {
      return <StatusInline status={row.status} />;
    },
  },
  {
    id: "started_time",
    label: "Started at",
    render: function RunStartedTime(row) {
      return row.started_time ? (
        formatServerDateTime(row.started_time)
      ) : (
        <i>Not yet started</i>
      );
    },
  },
];

type PipelineRunRow = { uuid: string; spec: string };

const runSpecTableColumns: DataTableColumn<PipelineRunRow>[] = [
  {
    id: "spec",
    label: "Run specification",
    render: function RunSpec(row) {
      return row.spec === PARAMETERLESS_RUN ? <i>{row.spec}</i> : row.spec;
    },
  },
];

const RunSpecTable = ({ rows }: { rows: PipelineRunRow[] }) => {
  return (
    <DataTable<PipelineRunRow>
      id="run-spec-list"
      columns={runSpecTableColumns}
      rows={rows}
    />
  );
};

const useFetchJob = (jobUuid?: string) => {
  const { data, error, run, status } = useAsync<Job>();
  const [job, setJob] = React.useState<Job>();

  const fetchJob = React.useCallback(
    () => run(fetcher(`/catch/api-proxy/api/jobs/${jobUuid}`)),
    [jobUuid]
  );
  React.useEffect(() => {
    if (data) setJob(data);
  }, [data]);
  React.useEffect(() => {
    if (jobUuid) run(fetcher(`/catch/api-proxy/api/jobs/${jobUuid}`));
  }, [jobUuid]);

  const envVariables: { name: string; value: string }[] = React.useMemo(() => {
    return job ? envVariablesDictToArray<string>(job.env_variables) : [];
  }, [job]);

  return {
    job,
    setJob,
    envVariables,
    fetchJob,
    fetchJobError: error,
    fetchJobStatus: status,
  };
};

const useFetchPipeline = (
  job?: Pick<Job, "pipeline_uuid" | "project_uuid" | "uuid">
) => {
  const { pipeline_uuid, project_uuid, uuid } = job || {};
  const { data, run, status, error, setError } = useAsync<PipelineJson>();

  React.useEffect(() => {
    if (hasValue(pipeline_uuid) && hasValue(project_uuid) && hasValue(uuid)) {
      try {
        const pipelineJSONEndpoint = getPipelineJSONEndpoint(
          pipeline_uuid,
          project_uuid,
          uuid
        );
        run(
          fetcher<{
            pipeline_json: string;
            success: boolean;
          }>(pipelineJSONEndpoint).then((result) => {
            if (!result.success) {
              throw new Error("Failed to fetch pipeline.json");
            }
            return JSON.parse(result.pipeline_json) as PipelineJson;
          })
        );
      } catch (err) {
        setError(`Unable to load pipeline: ${err}`);
      }
    }
  }, [pipeline_uuid, project_uuid, uuid]);

  return {
    pipeline: data,
    fetchPipelineError: error,
    fetchPipelineStatus: status,
  };
};

const JobView: React.FC = () => {
  // global states
  const { setAlert, requestBuild } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.job.path });

  // data from route
  const { navigateTo, projectUuid, jobUuid } = useCustomRoute();

  // data states
  const {
    job,
    setJob,
    fetchJob,
    envVariables,
    fetchJobError,
    fetchJobStatus,
  } = useFetchJob(jobUuid);
  const {
    pipeline,
    fetchPipelineError,
    fetchPipelineStatus,
  } = useFetchPipeline(job);

  React.useEffect(() => {
    if (fetchPipelineError) setAlert("Error", fetchPipelineError.message);
    if (fetchJobError) setAlert("Error", fetchJobError.message);
  }, [fetchPipelineError, fetchJobError]);

  // UI states
  const [tabIndex, setTabIndex] = React.useState(0);

  const [promiseManager] = React.useState(new PromiseManager());

  const onSelectSubview = (e, index: number) => {
    setTabIndex(index);
  };

  const reload = () => {
    fetchJob();
  };

  const onDetailPipelineView = (pipelineRun) => {
    if (pipelineRun.status == "PENDING") {
      setAlert(
        "Error",
        "This pipeline is still pending. Please wait until pipeline run has started."
      );

      return;
    }

    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid: pipelineRun.project_uuid,
        pipelineUuid: pipelineRun.pipeline_uuid,
        jobUuid: pipelineRun.job_uuid,
        runUuid: pipelineRun.uuid,
      },
      state: { isReadOnly: true },
    });
  };

  const cancelJob = () => {
    fetcher(`/catch/api-proxy/api/jobs/${job.uuid}`, { method: "DELETE" })
      .then(() => setJob((prevJob) => ({ ...prevJob, status: "ABORTED" })))
      .catch((error) => {
        console.error(error);
        setAlert("Error", `Failed to delete job: ${error}`);
      });
  };

  const pauseCronJob = () => {
    fetcher(`/catch/api-proxy/api/jobs/cronjobs/pause/${job.uuid}`, {
      method: "POST",
    })
      .then(() =>
        setJob((job) => ({
          ...job,
          status: "PAUSED",
          next_scheduled_time: undefined,
        }))
      )
      .catch((error) => {
        console.error(error);
        setAlert("Error", `Failed to pause job: ${error}`);
      });
  };

  const resumeCronJob = () => {
    fetcher(`/catch/api-proxy/api/jobs/cronjobs/resume/${job.uuid}`, {
      method: "POST",
    })
      .then((data: string) => {
        let parsedData: Job = JSON.parse(data);
        setJob((job) => ({
          ...job,
          status: "STARTED",
          next_scheduled_time: parsedData.next_scheduled_time,
        }));
      })
      .catch((error) => {
        console.error(error);
        setAlert("Error", `Failed to resume job: ${error}`);
      });
  };

  const editJob = () => {
    navigateTo(siteMap.editJob.path, {
      query: {
        projectUuid,
        jobUuid: job.uuid,
      },
    });
  };

  const returnToJobs = () => {
    navigateTo(siteMap.jobs.path, {
      query: {
        projectUuid: job.project_uuid,
      },
    });
  };

  const tabs = React.useMemo(() => {
    if (!job) return [];
    return [
      {
        id: "pipeline-runs",
        label: `Pipeline runs (${
          job.pipeline_runs.filter(({ status }) =>
            ["SUCCESS", "ABORTED", "FAILURE"].includes(status)
          ).length
        }/${job.pipeline_runs.length})`,
        icon: <ListIcon />,
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
    ];
  }, [job?.pipeline_runs]);

  const onJobDuplicate = () => {
    if (!job) {
      return;
    }
    checkGate(job.project_uuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/duplicate", {
            type: "json",
            content: {
              job_uuid: job.uuid,
            },
          }),
          promiseManager
        );

        postJobPromise.promise
          .then((response) => {
            let job: Job = JSON.parse(response);

            // we need to re-navigate to ensure the URL is with correct job uuid
            navigateTo(siteMap.editJob.path, {
              query: {
                projectUuid: job.project_uuid,
                jobUuid: job.uuid,
              },
            });
          })
          .catch((response) => {
            if (!response.isCanceled) {
              try {
                let result = JSON.parse(response.body);
                setTimeout(() => {
                  setAlert("Error", `Failed to create job. ${result.message}`);
                });
              } catch (error) {
                console.log(error);
              }
            }
          });
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          requestBuild(job.project_uuid, result.data, "DuplicateJob", () => {
            onJobDuplicate();
          });
        }
      });
  };

  const isLoading = !pipeline || !job;

  const tabView = isLoading ? null : (
    <Box sx={{ flex: 1 }}>
      <CustomTabPanel value={tabIndex} index={0} name="pipeline-runs-tab">
        <DataTable<PipelineRun>
          id="job-pipeline-runs"
          data-test-id="job-pipeline-runs"
          rows={job.pipeline_runs.map((run) => {
            const formattedRunParams = formatPipelineParams(run.parameters);
            const hasParameters = formattedRunParams.length > 0;
            const formattedRunParamsAsString = hasParameters
              ? formattedRunParams.join(", ")
              : PARAMETERLESS_RUN;

            const paramDetails = !hasParameters ? (
              <NoParameterAlert />
            ) : (
              <>
                <Typography variant="body2">
                  Pipeline: {pipeline.name}
                </Typography>
                {formattedRunParams.map((param, index) => (
                  <Typography
                    variant="caption"
                    key={index}
                    sx={{ paddingLeft: (theme) => theme.spacing(1) }}
                  >
                    {param}
                  </Typography>
                ))}
              </>
            );

            return {
              ...run,
              searchIndex: `${
                run.status === "STARTED" ? "Running" : ""
              }${formattedRunParamsAsString}`,
              details: (
                <Stack
                  direction="column"
                  alignItems="flex-start"
                  sx={{ padding: (theme) => theme.spacing(2, 1) }}
                >
                  {paramDetails}
                  <Button
                    variant="contained"
                    startIcon={<VisibilityIcon />}
                    onClick={() => onDetailPipelineView(run)}
                    sx={{ marginTop: (theme) => theme.spacing(2) }}
                    data-test-id="job-pipeline-runs-row-view-pipeline"
                  >
                    View pipeline
                  </Button>
                </Stack>
              ),
            };
          })}
          columns={columns}
          initialOrderBy="pipeline_run_index"
          initialOrder="desc"
        />
      </CustomTabPanel>
      <CustomTabPanel value={tabIndex} index={1} name="parameters-tab">
        <ParameterEditor
          readOnly
          pipelineName={pipeline.name}
          strategyJSON={job.strategy_json}
        />
        <div className="pipeline-runs push-up">
          <RunSpecTable
            rows={
              job.parameters
                ? job.parameters.map((param, index) => {
                    let parameters = formatPipelineParams(param);

                    return {
                      uuid: index.toString(),
                      spec:
                        parameters.length > 0
                          ? parameters.join(", ")
                          : PARAMETERLESS_RUN,
                    };
                  })
                : []
            }
          />
        </div>
      </CustomTabPanel>
      <CustomTabPanel value={tabIndex} index={2} name="pipeline-runs-tab">
        <EnvVarList value={envVariables} readOnly />
      </CustomTabPanel>
    </Box>
  );

  return (
    <Layout fullHeight>
      <>
        {isLoading ? (
          <LinearProgress />
        ) : (
          <div className="view-page job-view fullheight">
            <div className="push-down">
              <Button
                color="secondary"
                startIcon={<ArrowBackIcon />}
                onClick={returnToJobs}
              >
                Back to jobs
              </Button>
            </div>

            <DescriptionList
              gap="5"
              columnGap="10"
              columns={{ initial: 1, "@lg": 2 }}
              css={{ marginBottom: "$5" }}
              items={[
                { term: "Name", details: job.name },
                { term: "Pipeline", details: job.pipeline_name },
                { term: "Status", details: <JobStatus {...job} /> },
                {
                  term: "Schedule",
                  details: (
                    <Stack component="span" direction="column">
                      <Typography
                        variant="h6"
                        component="span"
                        sx={{
                          fontWeight: (theme) =>
                            theme.typography.fontWeightRegular,
                        }}
                      >
                        {job.schedule === null ? "Run once" : job.schedule}
                      </Typography>
                      {job.schedule !== null && (
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{ lineHeight: "normal" }}
                        >
                          {cronstrue.toString(job.schedule) + " (UTC)"}
                        </Typography>
                      )}
                    </Stack>
                  ),
                },
                {
                  term: "Snapshot date",
                  details: formatServerDateTime(job.created_time),
                },
                {
                  term: "Scheduled to run",
                  details:
                    job.status === "ABORTED"
                      ? "Cancelled"
                      : job.status === "PAUSED"
                      ? "Paused"
                      : job.next_scheduled_time
                      ? formatServerDateTime(job.next_scheduled_time)
                      : formatServerDateTime(job.last_scheduled_time),
                },
              ]}
            />
            <Tabs
              value={tabIndex}
              onChange={onSelectSubview}
              label="View Job Tabs"
              data-test-id="job-view"
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

            {tabView}

            <div className="separated">
              <Button
                disabled={
                  fetchJobStatus === "PENDING" ||
                  fetchPipelineStatus === "PENDING"
                }
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={reload}
                data-test-id="job-refresh"
              >
                Refresh
              </Button>

              <Button
                startIcon={<FileCopyIcon />}
                onClick={onJobDuplicate}
                color="secondary"
              >
                Copy config to new job
              </Button>

              {job.schedule !== null &&
                ["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                  <Button
                    variant="contained"
                    onClick={editJob}
                    startIcon={<TuneIcon />}
                  >
                    Edit
                  </Button>
                )}

              {job.schedule !== null && job.status === "STARTED" && (
                <Button
                  color="secondary"
                  variant="contained"
                  startIcon={<PauseIcon />}
                  onClick={pauseCronJob}
                >
                  Pause
                </Button>
              )}

              {job.schedule !== null && job.status === "PAUSED" && (
                <Button
                  variant="contained"
                  onClick={resumeCronJob}
                  startIcon={<PlayArrowIcon />}
                >
                  Resume
                </Button>
              )}

              {["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                <Button
                  color="secondary"
                  variant="contained"
                  startIcon={<CloseIcon />}
                  onClick={cancelJob}
                >
                  Cancel job
                </Button>
              )}
            </div>
          </div>
        )}
      </>
    </Layout>
  );
};

export default JobView;
