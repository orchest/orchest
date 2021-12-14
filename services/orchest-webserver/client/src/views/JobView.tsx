import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { DescriptionList } from "@/components/DescriptionList";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import ParamTree from "@/components/ParamTree";
import SearchableTable from "@/components/SearchableTable";
import { StatusGroup, StatusInline, TStatus } from "@/components/Status";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import theme from "@/theme";
import type { Job, PipelineJson, PipelineRun } from "@/types";
import { commaSeparatedString } from "@/utils/text";
import {
  checkGate,
  envVariablesDictToArray,
  formatServerDateTime,
  getPipelineJSONEndpoint,
} from "@/utils/webserver-utils";
import ListIcon from "@mui/icons-material/List";
import TuneIcon from "@mui/icons-material/Tune";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import { MDCButtonReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import cronstrue from "cronstrue";
import React from "react";
import { PieChart } from "react-minimal-pie-chart";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

const JobStatus: React.FC<{
  status?: TStatus;
  pipeline_runs?: PipelineRun[];
}> = ({ status, pipeline_runs = [] }) => {
  const count = pipeline_runs.reduce(
    (acc, cv, i) =>
      cv && {
        ...acc,
        [cv.status]: acc[cv.status] + 1,
        total: i + 1,
      },
    {
      ABORTED: 0,
      PENDING: 0,
      STARTED: 0,
      SUCCESS: 0,
      FAILURE: 0,
      total: 0,
    }
  );

  const getJobStatusVariant = () => {
    if (["STARTED", "PAUSED", "SUCCESS", "ABORTED"].includes(status))
      return status;

    if (
      ["PENDING"].includes(status) &&
      count.PENDING + count.STARTED === count.total
    )
      return "PENDING";

    if (status === "FAILURE" && count.ABORTED + count.FAILURE === count.total)
      return "FAILURE";

    if (status === "FAILURE") return "MIXED_FAILURE";
    if (status === "PENDING") return "MIXED_PENDING";

    return status;
  };

  const variant = getJobStatusVariant();
  return (
    <StatusGroup
      status={status}
      icon={
        ["MIXED_FAILURE", "MIXED_PENDING"].includes(variant) && (
          <PieChart
            startAngle={270}
            background={theme.palette.background.default}
            lineWidth={40}
            animate={true}
            data={[
              {
                title: "Pending",
                color: theme.palette.warning.main,
                value: count.PENDING + count.STARTED,
              },
              {
                title: "Failed",
                color: theme.palette.error.main,
                value: count.FAILURE + count.ABORTED,
              },
              {
                title: "Success",
                color: theme.palette.success.main,
                value: count.SUCCESS,
              },
            ]}
          />
        )
      }
      title={
        {
          ABORTED: "This job was cancelled",
          PENDING: "Some pipeline runs haven't completed yet",
          FAILURE: "All pipeline runs were unsuccessful",
          STARTED: "This job is running",
          PAUSED: "This job is paused",
          SUCCESS: "All pipeline runs were successful",
          MIXED_PENDING: "Some pipeline runs haven't completed yet",
          MIXED_FAILURE: "Some pipeline runs were unsuccessful",
        }[variant]
      }
      description={
        ["MIXED_FAILURE", "MIXED_PENDING"].includes(variant) &&
        [
          commaSeparatedString(
            [
              count.PENDING && [count.PENDING, "pending"].join(" "),
              count.FAILURE && [count.FAILURE, "failed"].join(" "),
              count.SUCCESS && [count.SUCCESS, "successful"].join(" "),
            ].filter(Boolean)
          ),
          count.total > 1 ? "pipeline runs" : "pipeline run",
        ].join(" ")
      }
      data-test-id="job-status"
    />
  );
};

const formatPipelineParams = (parameters) => {
  let keyValuePairs = [];

  for (let strategyJSONKey in parameters) {
    for (let parameter in parameters[strategyJSONKey]) {
      keyValuePairs.push(
        parameter +
          ": " +
          JSON.stringify(parameters[strategyJSONKey][parameter])
      );
    }
  }

  if (keyValuePairs.length == 0) {
    return <i>Parameterless run</i>;
  }

  return keyValuePairs.join(", ");
};

const columns: DataTableColumn<PipelineRun>[] = [
  { id: "pipeline_run_index", label: "ID" },
  {
    id: "parameters",
    label: "Parameters",
    render: (row) => formatPipelineParams(row.parameters),
  },
  {
    id: "status",
    label: "Status",
    render: (row) => <StatusInline status={row.status} />,
  },
  {
    id: "started_time",
    label: "Started at",
    render: (row) =>
      row.started_time ? (
        formatServerDateTime(row.started_time)
      ) : (
        <i>Not yet started</i>
      ),
  },
];

const JobView: React.FC = () => {
  // global states
  const { setAlert, requestBuild } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.job.path });

  // data from route
  const { navigateTo, projectUuid, jobUuid } = useCustomRoute();

  // data states
  const [job, setJob] = React.useState<Job>();
  const [pipeline, setPipeline] = React.useState<PipelineJson>();
  const [envVariables, setEnvVariables] = React.useState<
    { name: string; value: string }[]
  >([]);

  // UI states
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  React.useEffect(() => {
    fetchJob();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  const onSelectSubview = (e, index: number) => {
    setTabIndex(index);
  };

  const fetchJob = () => {
    makeRequest("GET", `/catch/api-proxy/api/jobs/${jobUuid}`).then(
      (response: string) => {
        try {
          let job: Job = JSON.parse(response);

          setJob(job);
          setEnvVariables(envVariablesDictToArray<string>(job.env_variables));
          setIsRefreshing(false);

          fetchPipeline(job);
        } catch (error) {
          setIsRefreshing(false);
          console.error("Failed to fetch job.", error);
        }
      }
    );
  };

  const fetchPipeline = (job) => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      job.pipeline_uuid,
      job.project_uuid,
      job.uuid
    );

    makeRequest("GET", pipelineJSONEndpoint).then((response: string) => {
      let result: {
        pipeline_json: string;
        success: boolean;
      } = JSON.parse(response);

      if (result.success) {
        let fetchedPipeline: PipelineJson = JSON.parse(result.pipeline_json);
        setPipeline(fetchedPipeline);
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  };

  const reload = () => {
    setIsRefreshing(true);
    fetchJob();
  };

  const parameterValueOverride = (strategyJSON, parameters) => {
    for (let strategyJSONKey in parameters) {
      for (let parameter in parameters[strategyJSONKey]) {
        strategyJSON[strategyJSONKey]["parameters"][parameter] =
          parameters[strategyJSONKey][parameter];
      }
    }

    return strategyJSON;
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
    let deleteJobRequest = makeCancelable(
      makeRequest("DELETE", `/catch/api-proxy/api/jobs/${job.uuid}`),
      promiseManager
    );
    /** @ts-ignore */
    deleteJobRequest.promise
      .then(() => {
        setJob((prevJob) => ({ ...prevJob, status: "ABORTED" }));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const pauseCronJob = () => {
    let pauseCronJobRequest = makeCancelable(
      makeRequest(
        "POST",
        `/catch/api-proxy/api/jobs/cronjobs/pause/${job.uuid}`
      ),
      promiseManager
    );
    /** @ts-ignore */
    pauseCronJobRequest.promise
      .then(() => {
        setJob((job) => ({
          ...job,
          status: "PAUSED",
          next_scheduled_time: undefined,
        }));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const resumeCronJob = () => {
    let pauseCronJobRequest = makeCancelable(
      makeRequest(
        "POST",
        `/catch/api-proxy/api/jobs/cronjobs/resume/${job.uuid}`
      ),
      promiseManager
    );
    /** @ts-ignore */
    pauseCronJobRequest.promise
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
      });
  };

  const generatedParametersToTableData = (jobGeneratedParameters) => {
    let rows = [];

    for (let idx in jobGeneratedParameters) {
      let params = jobGeneratedParameters[idx];

      let pipelineRunRow = [];

      for (let fullParam in params) {
        for (let paramKey in params[fullParam]) {
          pipelineRunRow.push(
            paramKey + ": " + JSON.stringify(params[fullParam][paramKey])
          );
        }
      }
      if (pipelineRunRow.length > 0) {
        rows.push([pipelineRunRow.join(", ")]);
      } else {
        rows.push([<i>Parameterless run</i>]); // eslint-disable-line react/jsx-key
      }
    }

    return rows;
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
        id: "pipeline-runs-tab",
        label: `Pipeline runs (${
          job.pipeline_runs.filter(({ status }) =>
            ["SUCCESS", "ABORTED", "FAILURE"].includes(status)
          ).length
        }/${job.pipeline_runs.length})`,
        icon: <ListIcon />,
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
    ];
  }, [job?.pipeline_runs]);

  const detailRows = (pipelineRuns) => {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineRuns.length; x++) {
      let pipelineRun = pipelineRuns[x];
      let strategyJSON = JSON.parse(JSON.stringify(job.strategy_json));

      strategyJSON = parameterValueOverride(
        strategyJSON,
        pipelineRun.parameters
      );

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree strategyJSON={strategyJSON} pipelineName={pipeline.name} />
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() => onDetailPipelineView(pipelineRun)}
            data-test-id={`job-pipeline-runs-row-view-pipeline-${x}`}
          >
            View pipeline
          </Button>
        </div>
      );
    }

    return detailElements;
  };

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
    <>
      <CustomTabPanel value={tabIndex} index={0} name="pipeline-runs-tab">
        <DataTable<PipelineRun>
          id="job-pipeline-runs"
          data-test-id="job-pipeline-runs"
          // TODO: make it collapse-able
          rows={job.pipeline_runs.map((run) => ({
            ...run,
            searchIndex: `${
              run.status === "STARTED" ? "Running" : ""
            }${JSON.stringify(formatPipelineParams(run.parameters))}`,
          }))}
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
          <SearchableTable
            selectable={false}
            headers={["Run specification"]}
            rows={generatedParametersToTableData(job.parameters)}
          />
        </div>
      </CustomTabPanel>
      <CustomTabPanel value={tabIndex} index={2} name="pipeline-runs-tab">
        <EnvVarList value={envVariables} readOnly={true} />
      </CustomTabPanel>
    </>
  );

  return (
    <Layout>
      <div className="view-page job-view">
        {isLoading ? (
          <LinearProgress />
        ) : (
          <div className="view-page job-view">
            <div className="push-down">
              <MDCButtonReact
                label="Back to jobs"
                icon="arrow_back"
                onClick={returnToJobs}
              />
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
                />
              ))}
            </Tabs>

            {tabView}

            <div className="separated">
              <MDCButtonReact
                disabled={isRefreshing}
                label="Refresh"
                icon="refresh"
                onClick={reload}
                data-test-id="job-refresh"
              />

              <MDCButtonReact
                label="Copy config to new job"
                icon="file_copy"
                onClick={onJobDuplicate}
              />

              {job.schedule !== null &&
                ["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                  <MDCButtonReact
                    classNames={["mdc-button--raised", "themed-secondary"]}
                    onClick={editJob}
                    icon="tune"
                    label="Edit"
                  />
                )}

              {job.schedule !== null && job.status === "STARTED" && (
                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  icon="pause"
                  label="Pause"
                  onClick={pauseCronJob}
                />
              )}

              {job.schedule !== null && job.status === "PAUSED" && (
                <MDCButtonReact
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={resumeCronJob}
                  icon="play_arrow"
                  label="Resume"
                />
              )}

              {["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  label="Cancel job"
                  icon="close"
                  onClick={cancelJob}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobView;
