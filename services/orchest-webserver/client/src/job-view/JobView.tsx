import { TabPanel } from "@/components/common/Tabs";
import { DescriptionList } from "@/components/DescriptionList";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParameterEditor from "@/components/ParameterEditor";
import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchProject } from "@/hooks/useFetchProject";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type { Job } from "@/types";
import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { fetcher, HEADER } from "@orchest/lib-utils";
import cronstrue from "cronstrue";
import React from "react";
import { useFetchJob } from "../hooks/useFetchJob";
import { formatPipelineParams, PARAMETERLESS_RUN } from "./common";
import { JobDocLink } from "./JobDocLink";
import { JobStatus } from "./JobStatus";
import { JobViewTabs } from "./JobViewTabs";
import { PipelineRunTable } from "./PipelineRunTable";
import { RunSpecTable } from "./RunSpecTable";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(3, 0),
}));

const JobView: React.FC = () => {
  // global states
  const { setAlert, requestBuild } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.job.path });

  // data from route
  const { navigateTo, jobUuid } = useCustomRoute();

  // data states
  const { job, setJob, fetchJob, envVariables, isFetchingJob } = useFetchJob({
    jobUuid,
    runStatuses: true,
  });

  // monitor if there's any operations ongoing, if so, disable action buttons
  const { run, status } = useAsync<void>();
  const isOperating = status === "PENDING" || isFetchingJob;

  // use this to force PipelineRunTable to re-fetch data
  const [pipelineRunTableKey, forceUpdatePipelineRunTable] = React.useReducer(
    (x: number) => x + 1,
    0
  );

  const reload = () => {
    fetchJob();
    forceUpdatePipelineRunTable();
  };

  const cancelJob = () => {
    run(
      fetcher(`/catch/api-proxy/api/jobs/${job.uuid}`, { method: "DELETE" })
        .then(() => {
          setJob((prevJob) => ({ ...prevJob, status: "ABORTED" }));
        })
        .catch((error) => {
          console.error(error);
          setAlert("Error", `Failed to delete job: ${error}`);
        })
    );
  };

  const pauseCronJob = () => {
    run(
      fetcher(`/catch/api-proxy/api/jobs/cronjobs/pause/${job.uuid}`, {
        method: "POST",
      })
        .then(() => {
          setJob((job) => ({
            ...job,
            status: "PAUSED",
            next_scheduled_time: undefined,
          }));
        })
        .catch((error) => {
          console.error(error);
          setAlert("Error", `Failed to pause job: ${error}`);
        })
    );
  };

  const resumeCronJob = () => {
    run(
      fetcher(`/catch/api-proxy/api/jobs/cronjobs/resume/${job.uuid}`, {
        method: "POST",
      })
        .then((data: { next_scheduled_time: string }) => {
          setJob((job) => ({
            ...job,
            status: "STARTED",
            next_scheduled_time: data.next_scheduled_time,
          }));
        })
        .catch((error) => {
          console.error(error);
          setAlert("Error", `Failed to resume job: ${error}`);
        })
    );
  };

  const editJob = (e: React.MouseEvent) => {
    navigateTo(
      siteMap.editJob.path,
      { query: { projectUuid: job.project_uuid, jobUuid: job.uuid } },
      e
    );
  };

  const returnToJobs = (e: React.MouseEvent) => {
    navigateTo(
      siteMap.jobs.path,
      { query: { projectUuid: job.project_uuid } },
      e
    );
  };

  const onJobDuplicate = (e: React.MouseEvent) => {
    if (!job) return;

    run(
      checkGate(job.project_uuid)
        .then(() => {
          fetcher<Job>("/catch/api-proxy/api/jobs/duplicate", {
            method: "POST",
            headers: HEADER.JSON,
            body: JSON.stringify({ job_uuid: job.uuid }),
          })
            .then((response) => {
              // we need to re-navigate to ensure the URL is with correct job uuid
              navigateTo(
                siteMap.editJob.path,
                {
                  query: {
                    projectUuid: response.project_uuid,
                    jobUuid: response.uuid,
                  },
                },
                e
              );
            })
            .catch((error) => {
              try {
                let result = JSON.parse(error.body);
                setTimeout(() => {
                  setAlert("Error", `Failed to create job. ${result.message}`);
                });
              } catch (error) {
                console.log(error);
              }
            });
        })
        .catch((result) => {
          if (result.reason === "gate-failed") {
            requestBuild(job.project_uuid, result.data, "DuplicateJob", () => {
              onJobDuplicate(e);
            });
          }
        })
    );
  };
  const [totalRunCount, setTotalRunCount] = React.useState<
    number | undefined
  >();

  const isJobDone = job?.status === "SUCCESS" || job?.status === "ABORTED";

  // we only need to check snapshot size if necessary (i.e. job is not done, and auto clean-up is not enabled)
  // because we need to show the warning to user if their snapshot size is too big
  const { data: projectSnapshotSize = 0 } = useFetchProject({
    projectUuid:
      !isJobDone && job?.max_retained_pipeline_runs < 0 && job?.project_uuid
        ? job.project_uuid
        : null,
    selector: (project) => project.project_snapshot_size,
  });

  const footnote =
    job?.max_retained_pipeline_runs > 0 ? (
      `Only the ${job.max_retained_pipeline_runs} most recent pipeline runs are kept`
    ) : job?.max_retained_pipeline_runs === 0 ? (
      `all finished jobs will be automatically cleaned up`
    ) : projectSnapshotSize > 50 ? (
      <>
        {`Snapshot size exceeds 50MB. You might want to enable Auto Clean-up to free up disk space regularly. Check the `}
        <JobDocLink />
        {` for more details.`}
      </>
    ) : null;

  return (
    <Layout>
      <>
        {!job ? (
          <LinearProgress />
        ) : (
          <div className="view-page job-view fullheight">
            <div className="push-down">
              <Button
                color="secondary"
                startIcon={<ArrowBackIcon />}
                onAuxClick={returnToJobs}
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
                {
                  term: "Status",
                  details: <JobStatus {...job} totalCount={totalRunCount} />,
                },
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
            <JobViewTabs job={job} totalRunCount={totalRunCount}>
              {(tabIndex) => {
                return (
                  <Box sx={{ flex: 1 }}>
                    <CustomTabPanel
                      value={tabIndex}
                      index={0}
                      name="pipeline-runs-tab"
                      sx={{ paddingBottom: 0 }}
                    >
                      <PipelineRunTable
                        key={pipelineRunTableKey}
                        jobUuid={jobUuid}
                        pipelineName={job.pipeline_name}
                        setTotalCount={setTotalRunCount}
                        footnote={footnote}
                      />
                    </CustomTabPanel>
                    <CustomTabPanel
                      value={tabIndex}
                      index={1}
                      name="parameters-tab"
                    >
                      <ParameterEditor
                        readOnly
                        pipelineName={job.pipeline_name}
                        strategyJSON={job.strategy_json}
                      />
                      <div className="pipeline-runs push-up">
                        <RunSpecTable
                          isLoading={isFetchingJob}
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
                    <CustomTabPanel
                      value={tabIndex}
                      index={2}
                      name="pipeline-runs-tab"
                    >
                      <EnvVarList value={envVariables} readOnly />
                    </CustomTabPanel>
                  </Box>
                );
              }}
            </JobViewTabs>
            <Stack
              spacing={3}
              direction="row"
              sx={{
                paddingBottom: (theme) => theme.spacing(3),
                marginBottom: (theme) => theme.spacing(-4), // this is to counter-balance the layout padding
              }}
            >
              <Button
                disabled={isOperating}
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={reload}
                data-test-id="job-refresh"
              >
                Refresh
              </Button>

              <Button
                disabled={isOperating}
                startIcon={<FileCopyIcon />}
                onClick={onJobDuplicate}
                onAuxClick={onJobDuplicate}
                color="secondary"
              >
                Copy config to new job
              </Button>

              {job.schedule !== null &&
                ["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                  <Button
                    disabled={isOperating}
                    variant="contained"
                    onClick={editJob}
                    onAuxClick={editJob}
                    startIcon={<TuneIcon />}
                  >
                    Edit
                  </Button>
                )}

              {job.schedule !== null && job.status === "STARTED" && (
                <Button
                  disabled={isOperating}
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
                  disabled={isOperating}
                  variant="contained"
                  onClick={resumeCronJob}
                  startIcon={<PlayArrowIcon />}
                >
                  Resume
                </Button>
              )}

              {["STARTED", "PAUSED", "PENDING"].includes(job.status) && (
                <Button
                  disabled={isOperating}
                  color="secondary"
                  variant="contained"
                  startIcon={<CloseIcon />}
                  onClick={cancelJob}
                >
                  Cancel job
                </Button>
              )}
            </Stack>
          </div>
        )}
      </>
    </Layout>
  );
};

export default JobView;
