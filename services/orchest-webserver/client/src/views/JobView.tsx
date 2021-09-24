import { Box, Flex, Text } from "@orchest/design-system";
import type { Job, PipelineJson } from "@/types";
import {
  MDCButtonReact,
  MDCLinearProgressReact,
  MDCTabBarReact,
} from "@orchest/lib-mdc";
import {
  PromiseManager,
  RefManager,
  makeCancelable,
  makeRequest,
} from "@orchest/lib-utils";
import React, { useState } from "react";
import { StatusGroup, StatusInline, TStatus } from "@/components/Status";
import {
  checkGate,
  envVariablesDictToArray,
  formatServerDateTime,
  getPipelineJSONEndpoint,
} from "@/utils/webserver-utils";

import { DescriptionList } from "@/components/DescriptionList";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ParamTree from "@/components/ParamTree";
import ParameterEditor from "@/components/ParameterEditor";
import { PieChart } from "react-minimal-pie-chart";
import SearchableTable from "@/components/SearchableTable";
import { commaSeparatedString } from "@/utils/text";
import cronstrue from "cronstrue";
import { siteMap } from "@/Routes";
import { useCustomRoute } from "@/hooks/useCustomRoute";

type TSharedStatus = Extract<
  TStatus,
  "PENDING" | "STARTED" | "PAUSED" | "SUCCESS" | "FAILURE" | "ABORTED"
>;
type TJobStatus = TStatus | "DRAFT";

type TPipelineRun = { status: TSharedStatus };

interface IJobStatusProps {
  status?: TJobStatus;
  pipeline_runs?: TPipelineRun[];
}

const JobStatus: React.FC<IJobStatusProps> = ({
  status,
  pipeline_runs = [],
}) => {
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
      css={{ marginTop: "$2" }}
      status={status}
      icon={
        ["MIXED_FAILURE", "MIXED_PENDING"].includes(variant) && (
          <Box
            css={{
              padding: "calc($1 / 2)",
            }}
          >
            <PieChart
              startAngle={270}
              background="var(--colors-background)"
              lineWidth={30}
              animate={true}
              data={[
                {
                  title: "Pending",
                  color: "var(--colors-yellow300)",
                  value: count.PENDING + count.STARTED,
                },
                {
                  title: "Failed",
                  color: "var(--colors-error)",
                  value: count.FAILURE + count.ABORTED,
                },
                {
                  title: "Success",
                  color: "var(--colors-success)",
                  value: count.SUCCESS,
                },
              ]}
            />
          </Box>
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

const JobView: React.FC = () => {
  // global states
  const orchest = window.orchest;

  // data from route
  const { navigateTo, projectUuid, jobUuid } = useCustomRoute();

  // data states
  const [job, setJob] = useState<Job>();
  const [pipeline, setPipeline] = useState<PipelineJson>();
  const [envVariables, setEnvVariables] = useState<
    { name: string; value: string }[]
  >([]);

  // UI states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<[number, number]>([
    0,
    0,
  ]);

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  React.useEffect(() => {
    fetchJob();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  const onSelectSubview = (index: number) => {
    setSelectedTab(index);
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

  const onPipelineRunsSelectionChanged = (newIndices) => {
    setSelectedIndices(newIndices);
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

  const pipelineRunsToTableData = (pipelineRuns) => {
    let rows = [];

    for (let x = 0; x < pipelineRuns.length; x++) {
      rows.push([
        pipelineRuns[x].pipeline_run_index,
        formatPipelineParams(pipelineRuns[x].parameters),
        <StatusInline status={pipelineRuns[x].status} />,
        pipelineRuns[x].started_time ? (
          formatServerDateTime(pipelineRuns[x].started_time)
        ) : (
          <i>Not yet started</i>
        ),
      ]);
    }

    return rows;
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
      orchest.alert(
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
        rows.push([<i>Parameterless run</i>]);
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
          <MDCButtonReact
            label="View pipeline"
            classNames={["mdc-button--raised", "themed-secondary"]}
            icon="visibility"
            onClick={() => onDetailPipelineView(pipelineRun)}
            data-test-id={`job-pipeline-runs-row-view-pipeline-${x}`}
          />
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
                  orchest.alert(
                    "Error",
                    "Failed to create job. " + result.message
                  );
                });
              } catch (error) {
                console.log(error);
              }
            }
          });
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          orchest.requestBuild(
            job.project_uuid,
            result.data,
            "DuplicateJob",
            () => {
              onJobDuplicate();
            }
          );
        }
      });
  };

  const isLoading = !pipeline || !job;

  const tabView = isLoading ? null : (
    <div className="tab-view">
      {selectedTab === 0 && (
        <div className="pipeline-tab-view existing-pipeline-runs">
          <SearchableTable
            rows={pipelineRunsToTableData(job.pipeline_runs)}
            detailRows={detailRows(job.pipeline_runs)}
            headers={["ID", "Parameters", "Status", "Started at"]}
            selectedIndices={selectedIndices}
            onSelectionChanged={onPipelineRunsSelectionChanged}
            data-test-id="job-pipeline-runs"
          />
        </div>
      )}
      {selectedTab === 1 && (
        <div className="pipeline-tab-view">
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
        </div>
      )}
      {selectedTab === 2 && (
        <div className="pipeline-tab-view">
          <EnvVarList value={envVariables} readOnly={true} />
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="view-page job-view">
        {isLoading ? (
          <MDCLinearProgressReact />
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
                    <Flex as="span" css={{ flexDirection: "column" }}>
                      {job.schedule === null ? "Run once" : job.schedule}
                      {job.schedule !== null && (
                        <Text as="em" css={{ lineHeight: "normal" }}>
                          {cronstrue.toString(job.schedule) + " (UTC)"}
                        </Text>
                      )}
                    </Flex>
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

            <MDCTabBarReact
              selectedIndex={selectedTab}
              /** @ts-ignore */
              ref={refManager.nrefs.tabBar}
              items={[
                "Pipeline runs (" +
                  job.pipeline_runs.filter(({ status }) =>
                    ["SUCCESS", "ABORTED", "FAILURE"].includes(status)
                  ).length +
                  "/" +
                  +job.pipeline_runs.length +
                  ")",
                "Parameters",
                "Environment variables",
              ]}
              icons={["list", "tune", "view_comfy"]}
              onChange={onSelectSubview}
            />

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
                label="Duplicate job"
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
                  onClick={pauseCronJob.bind(this)}
                />
              )}

              {job.schedule !== null && job.status === "PAUSED" && (
                <MDCButtonReact
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={resumeCronJob.bind(this)}
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
