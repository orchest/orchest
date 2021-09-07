import React from "react";
import { useHistory } from "react-router-dom";
import { PieChart } from "react-minimal-pie-chart";
import {
  Box,
  DIALOG_ANIMATION_DURATION,
  Flex,
  Text,
} from "@orchest/design-system";
import cronstrue from "cronstrue";
import {
  MDCButtonReact,
  MDCTabBarReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "@orchest/lib-utils";
import type { TViewProps } from "@/types";
import { useOrchest } from "@/hooks/orchest";
import { commaSeparatedString } from "@/utils/text";
import {
  checkGate,
  formatServerDateTime,
  getPipelineJSONEndpoint,
  envVariablesDictToArray,
} from "@/utils/webserver-utils";
import { Layout } from "@/components/Layout";
import { DescriptionList } from "@/components/DescriptionList";
import { StatusInline, StatusGroup, TStatus } from "@/components/Status";
import ParamTree from "@/components/ParamTree";
import ParameterEditor from "@/components/ParameterEditor";
import SearchableTable from "@/components/SearchableTable";
import EnvVarList from "@/components/EnvVarList";
import PipelineView from "@/pipeline-view/PipelineView";
import EditJobView from "@/views/EditJobView";
import JobsView from "@/views/JobsView";
import { generatePathFromRoute, siteMap, toQueryString } from "@/Routes";

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

const JobView: React.FC<TViewProps> = (props) => {
  const orchest = window.orchest;

  const history = useHistory<{ isReadOnly: boolean }>();

  const { dispatch } = useOrchest();
  const [state, setState] = React.useState({
    job: undefined,
    envVariables: undefined,
    selectedTabIndex: 0,
    selectedIndices: [0, 0],
    refreshing: false,
    pipeline: undefined,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  React.useEffect(() => {
    fetchJob();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  const onSelectSubview = (index) => {
    setState((prevState) => ({ ...prevState, selectedTabIndex: index }));
  };

  const fetchJob = () => {
    makeRequest(
      "GET",
      `/catch/api-proxy/api/jobs/${props.queryArgs.job_uuid}`
    ).then((response: string) => {
      try {
        let job = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          job,
          refreshing: false,
          envVariables: envVariablesDictToArray(job["env_variables"]),
        }));

        fetchPipeline(job);
      } catch (error) {
        setState((prevState) => ({ ...prevState, refreshing: false }));
        console.error("Failed to fetch job.", error);
      }
    });
  };

  const fetchPipeline = (job) => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      job.pipeline_uuid,
      job.project_uuid,
      job.uuid
    );

    makeRequest("GET", pipelineJSONEndpoint).then((response: string) => {
      let result = JSON.parse(response);
      if (result.success) {
        let pipeline = JSON.parse(result["pipeline_json"]);

        setState((prevState) => ({ ...prevState, pipeline }));
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  };

  const reload = () => {
    setState((prevState) => ({ ...prevState, refreshing: true }));
    fetchJob();
  };

  const onPipelineRunsSelectionChanged = (selectedIndices) => {
    setState((prevState) => ({ ...prevState, selectedIndices }));
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

    history.push({
      pathname: generatePathFromRoute(siteMap.pipeline.path, {
        projectId: pipelineRun.project_uuid,
        pipelineId: pipelineRun.pipeline_uuid,
      }),
      state: { isReadOnly: true },
      // TODO: check why PipelineView needs jobId and runId
      // they are needed in PipelineDetails, and making http calls, e.g. getPipelineJSONEndpoint
      search: toQueryString({
        job_uuid: pipelineRun.job_uuid,
        run_uuid: pipelineRun.uuid,
      }),
    });
  };

  const cancelJob = () => {
    let deleteJobRequest = makeCancelable(
      makeRequest("DELETE", `/catch/api-proxy/api/jobs/${state.job.uuid}`),
      promiseManager
    );
    /** @ts-ignore */
    deleteJobRequest.promise
      .then(() => {
        let job = state.job;
        job.status = "ABORTED";

        setState((prevState) => ({ ...prevState, job }));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const pauseCronJob = () => {
    let pauseCronJobRequest = makeCancelable(
      makeRequest(
        "POST",
        `/catch/api-proxy/api/jobs/cronjobs/pause/${state.job.uuid}`
      ),
      promiseManager
    );
    /** @ts-ignore */
    pauseCronJobRequest.promise
      .then(() => {
        let job = state.job;
        job.status = "PAUSED";
        job.next_scheduled_time = undefined;

        setState((prevState) => ({ ...prevState, job }));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const resumeCronJob = () => {
    let pauseCronJobRequest = makeCancelable(
      makeRequest(
        "POST",
        `/catch/api-proxy/api/jobs/cronjobs/resume/${state.job.uuid}`
      ),
      promiseManager
    );
    /** @ts-ignore */
    pauseCronJobRequest.promise
      .then((data: string) => {
        let parsedData = JSON.parse(data);
        let job = state.job;
        job.status = "STARTED";
        job.next_scheduled_time = parsedData.next_scheduled_time;

        setState((prevState) => ({ ...prevState, job }));
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
    history.push(
      generatePathFromRoute(siteMap.job.path, {
        projectId: state.job.project_uuid,
        jobId: state.job.uuid,
      })
    );
  };

  const returnToJobs = () => {
    dispatch({
      type: "projectSet",
      payload: state.job.project_uuid,
    });
    history.push({
      pathname: generatePathFromRoute(siteMap.jobs.path, {
        projectId: state.job.project_uuid,
      }),
    });
  };

  const detailRows = (pipelineRuns) => {
    let detailElements = [];

    // override values in fields through param fields
    for (let x = 0; x < pipelineRuns.length; x++) {
      let pipelineRun = pipelineRuns[x];
      let strategyJSON = JSON.parse(JSON.stringify(state.job.strategy_json));

      strategyJSON = parameterValueOverride(
        strategyJSON,
        pipelineRun.parameters
      );

      detailElements.push(
        <div className="pipeline-run-detail">
          <ParamTree
            strategyJSON={strategyJSON}
            pipelineName={state.pipeline.name}
          />
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
    if (state.job === undefined) {
      return;
    }
    checkGate(state.job.project_uuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/duplicate", {
            type: "json",
            content: {
              job_uuid: state.job.uuid,
            },
          }),
          promiseManager
        );

        postJobPromise.promise
          .then((response) => {
            let job = JSON.parse(response);

            history.push(
              generatePathFromRoute(siteMap.job.path, {
                projectId: state.job.project_uuid,
                jobId: state.job.uuid,
              })
            );
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
            state.job.project_uuid,
            result.data,
            "DuplicateJob",
            () => {
              onJobDuplicate();
            }
          );
        }
      });
  };

  let rootView;

  if (!state.pipeline || !state.job) {
    rootView = <MDCLinearProgressReact />;
  } else {
    let tabView = undefined;

    switch (state.selectedTabIndex) {
      case 0:
        tabView = (
          <div className="pipeline-tab-view existing-pipeline-runs">
            <SearchableTable
              rows={pipelineRunsToTableData(state.job.pipeline_runs)}
              detailRows={detailRows(state.job.pipeline_runs)}
              headers={["ID", "Parameters", "Status", "Started at"]}
              selectedIndices={state.selectedIndices}
              onSelectionChanged={onPipelineRunsSelectionChanged}
              data-test-id="job-pipeline-runs"
            />
          </div>
        );

        break;
      case 1:
        tabView = (
          <div className="pipeline-tab-view">
            <ParameterEditor
              readOnly
              pipelineName={state.pipeline.name}
              strategyJSON={state.job.strategy_json}
            />

            <div className="pipeline-runs push-up">
              <SearchableTable
                selectable={false}
                headers={["Run specification"]}
                rows={generatedParametersToTableData(state.job.parameters)}
              />
            </div>
          </div>
        );
        break;

      case 2:
        tabView = (
          <div className="pipeline-tab-view">
            <EnvVarList value={state.envVariables} readOnly={true} />
          </div>
        );
        break;
    }

    rootView = (
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
            { term: "Name", details: state.job.name },
            { term: "Pipeline", details: state.job.pipeline_name },
            { term: "Status", details: <JobStatus {...state.job} /> },
            {
              term: "Schedule",
              details: (
                <Flex as="span" css={{ flexDirection: "column" }}>
                  {state.job.schedule === null
                    ? "Run once"
                    : state.job.schedule}
                  {state.job.schedule !== null && (
                    <Text as="em" css={{ lineHeight: "normal" }}>
                      {cronstrue.toString(state.job.schedule) + " (UTC)"}
                    </Text>
                  )}
                </Flex>
              ),
            },
            {
              term: "Snapshot date",
              details: formatServerDateTime(state.job.created_time),
            },
            {
              term: "Scheduled to run",
              details:
                state.job.status === "ABORTED"
                  ? "Cancelled"
                  : state.job.status === "PAUSED"
                  ? "Paused"
                  : state.job.next_scheduled_time
                  ? formatServerDateTime(state.job.next_scheduled_time)
                  : formatServerDateTime(state.job.last_scheduled_time),
            },
          ]}
        />

        <MDCTabBarReact
          selectedIndex={state.selectedTabIndex}
          /** @ts-ignore */
          ref={refManager.nrefs.tabBar}
          items={[
            "Pipeline runs (" +
              state.job.pipeline_runs.filter(({ status }) =>
                ["SUCCESS", "ABORTED", "FAILURE"].includes(status)
              ).length +
              "/" +
              +state.job.pipeline_runs.length +
              ")",
            "Parameters",
            "Environment variables",
          ]}
          icons={["list", "tune", "view_comfy"]}
          onChange={onSelectSubview}
        />

        <div className="tab-view">{tabView}</div>

        <div className="separated">
          <MDCButtonReact
            disabled={state.refreshing}
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

          {state.job.schedule !== null &&
            ["STARTED", "PAUSED", "PENDING"].includes(state.job.status) && (
              <MDCButtonReact
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={editJob}
                icon="tune"
                label="Edit"
              />
            )}

          {state.job.schedule !== null && state.job.status === "STARTED" && (
            <MDCButtonReact
              classNames={["mdc-button--raised"]}
              icon="pause"
              label="Pause"
              onClick={pauseCronJob.bind(this)}
            />
          )}

          {state.job.schedule !== null && state.job.status === "PAUSED" && (
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={resumeCronJob.bind(this)}
              icon="play_arrow"
              label="Resume"
            />
          )}

          {["STARTED", "PAUSED", "PENDING"].includes(state.job.status) && (
            <MDCButtonReact
              classNames={["mdc-button--raised"]}
              label="Cancel job"
              icon="close"
              onClick={cancelJob}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="view-page job-view">{rootView}</div>
    </Layout>
  );
};

export default JobView;
