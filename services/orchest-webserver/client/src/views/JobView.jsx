// @ts-check
import React from "react";
import { PieChart } from "react-minimal-pie-chart";
import {
  Box,
  Flex,
  IconClockSolid,
  IconCheckCircleSolid,
  IconCrossCircleSolid,
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
import { useOrchest } from "@/hooks/orchest";
import {
  formatServerDateTime,
  getPipelineJSONEndpoint,
  envVariablesDictToArray,
} from "../utils/webserver-utils";
import { Status } from "../components/Status";
import ParamTree from "../components/ParamTree";
import ParameterEditor from "../components/ParameterEditor";
import SearchableTable from "../components/SearchableTable";
import EnvVarList from "../components/EnvVarList";
import PipelineView from "./PipelineView";
import EditJobView from "./EditJobView";
import JobsView from "./JobsView";

/**
 * @typedef {{status: import('../components/Status').TStatus}} IPipelineRun
 * @typedef {typeof JobView} Test
 *
 * @param {Object} props
 * @param {import("../components/Status").TStatus} [props.status]
 * @param {IPipelineRun[]} [props.pipeline_runs]
 */
const JobStatus = ({ status, pipeline_runs = [] }) => {
  /**
   * @typedef {Partial<Record<import("../components/Status").TStatus, number>>} IStatusCounts
   *
   * @type {IStatusCounts & {total: number}}
   */
  const count = pipeline_runs.reduce(
    (acc, cv, i) =>
      cv && {
        ...acc,
        [cv.status]: acc[cv.status] + 1,
        total: i + 1,
      },
    {
      ABORTED: 0,
      DRAFT: 0,
      PENDING: 0,
      STARTED: 0,
      SUCCESS: 0,
      FAILURE: 0,
      total: 0,
    }
  );

  /** @return {"DONUT" | "PENDING" | "FAILURE" | "SUCCESS"} */
  const variant = () => {
    if (
      (status === "PENDING" &&
        (count.total === 0 || count.PENDING + count.STARTED === count.total)) ||
      count.total === 0
    )
      return "PENDING";
    if (count.FAILURE + count.ABORTED === count.total) return "FAILURE";
    if (count.SUCCESS + count.ABORTED === count.total) return "SUCCESS";

    return "DONUT";
  };

  console.log(variant());
  return (
    <Flex css={{ alignItems: "center" }}>
      <Box css={{ flexShrink: 0 }}>
        {
          {
            PENDING: <IconClockSolid size="6" css={{ color: "$warning" }} />,
            FAILURE: (
              <IconCrossCircleSolid size="6" css={{ color: "$error" }} />
            ),
            SUCCESS: (
              <IconCheckCircleSolid size="6" css={{ color: "$success" }} />
            ),
            DONUT: (
              <Box
                css={{
                  width: "$space$6",
                  height: "$space$6",
                  padding: "calc($1 / 2)",
                }}
              >
                <PieChart
                  background="var(--colors-background)"
                  lineWidth={40}
                  animate={true}
                  data={[
                    {
                      title: "Draft",
                      color: "var(--colors-gray500)",
                      value: count.DRAFT,
                    },
                    {
                      title: "Pending & Starting",
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
            ),
          }[variant()]
        }
      </Box>

      <Box css={{ marginLeft: "$4" }}>
        <Text css={{ fontSize: "$lg", lineHeight: "$base" }}>
          {
            {
              PENDING: "Some pipeline runs haven't completed yet",
              FAILURE: "All pipeline runs were unsuccessful",
              SUCCESS: "All pipeline runs were successful",
              DONUT: "Some pipeline runs were unsuccessful",
            }[variant()]
          }
        </Text>
        {variant() === "DONUT" && (
          <p>
            {[
              [
                count.SUCCESS && [count.SUCCESS, "successful"].join(" "),
                count.FAILURE && [count.FAILURE, "failed"].join(" "),
              ]
                .filter(Boolean)
                .join(" and "),
              count.total > 1 ? "pipeline runs" : "pipeline run",
            ].join(" ")}
          </p>
        )}
      </Box>
    </Flex>
  );
};

/**
 * @param {Object} props
 * @param {{job_uuid: string}} props.queryArgs
 */
const JobView = (props) => {
  const orchest = window.orchest;

  const { dispatch } = useOrchest();
  const [state, setState] = React.useState({
    job: undefined,
    envVariables: undefined,
    selectedTabIndex: 0,
    selectedIndices: [0, 0],
    refreshing: false,
    pipeline: undefined,
  });

  const promiseManager = new PromiseManager();
  const refManager = new RefManager();

  React.useEffect(() => {
    fetchJob();
    return () => promiseManager.cancelCancelablePromises();
  }, []);

  const onSelectSubview = (index) => {
    setState((prevState) => ({ ...prevState, selectedTabIndex: index }));
  };

  console.log(props);

  const fetchJob = () => {
    makeRequest(
      "GET",
      `/catch/api-proxy/api/jobs/${props.queryArgs.job_uuid}`
    ).then(
      /** @param {string} response */
      (response) => {
        try {
          let job = JSON.parse(response);

          console.log("job => ", job);
          // pipeline status can be SUCCESS OR FAILURE

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
      }
    );
  };

  const fetchPipeline = (job) => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      job.pipeline_uuid,
      job.project_uuid,
      job.uuid
    );

    makeRequest("GET", pipelineJSONEndpoint).then(
      /** @param {string} response */
      (response) => {
        let result = JSON.parse(response);
        if (result.success) {
          let pipeline = JSON.parse(result["pipeline_json"]);

          setState((prevState) => ({ ...prevState, pipeline }));
        } else {
          console.warn("Could not load pipeline.json");
          console.log(result);
        }
      }
    );
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
        <Status status={pipelineRuns[x].status} />,
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

    orchest.loadView(PipelineView, {
      queryArgs: {
        job_uuid: pipelineRun.job_uuid,
        run_uuid: pipelineRun.uuid,
        pipeline_uuid: pipelineRun.pipeline_uuid,
        project_uuid: pipelineRun.project_uuid,
        read_only: "true",
      },
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
    orchest.loadView(EditJobView, {
      queryArgs: {
        job_uuid: state.job.uuid,
      },
    });
  };

  const returnToJobs = () => {
    dispatch({
      type: "projectSet",
      payload: state.job.project_uuid,
    });
    orchest.loadView(JobsView);
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
            onClick={onDetailPipelineView.bind(this, pipelineRun)}
          />
        </div>
      );
    }

    return detailElements;
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
              headers={["ID", "Parameters", "Status"]}
              selectedIndices={state.selectedIndices}
              onSelectionChanged={onPipelineRunsSelectionChanged.bind(this)}
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
            onClick={returnToJobs.bind(this)}
          />
        </div>

        <div className="columns top-labels">
          <div>
            <div className="column">
              <label>Name</label>
              <h3>{state.job.name}</h3>
            </div>
            <div className="column">
              <label>Pipeline</label>
              <h3>{state.pipeline.name}</h3>
            </div>
            <div className="clear"></div>
          </div>
          <div className="push-up">
            <div className="column">
              <label>Status</label>

              <Box
                css={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "$4",
                  marginTop: "$2",
                }}
              >
                <JobStatus
                  status="PENDING"
                  pipeline_runs={[
                    { status: "PENDING" },
                    { status: "PENDING" },
                    { status: "PENDING" },
                  ]}
                />
                <JobStatus
                  status="PENDING"
                  pipeline_runs={[
                    { status: "FAILURE" },
                    { status: "ABORTED" },
                    { status: "ABORTED" },
                    { status: "PENDING" },
                    { status: "SUCCESS" },
                  ]}
                />
                <JobStatus
                  status="FAILURE"
                  pipeline_runs={[
                    { status: "FAILURE" },
                    { status: "FAILURE" },
                    { status: "ABORTED" },
                  ]}
                />
                <JobStatus {...state.job} />
              </Box>
            </div>
            <div className="column">
              <label>Schedule</label>
              <h3>
                {state.job.schedule === null ? "Run once" : state.job.schedule}
              </h3>
              {state.job.schedule !== null && (
                <p>
                  <i>{cronstrue.toString(state.job.schedule)}</i>
                </p>
              )}
            </div>
            <div className="clear"></div>
          </div>
          <div className="push-up">
            <div className="column">
              <label>Snapshot date</label>
              <h3>{formatServerDateTime(state.job.created_time)}</h3>
            </div>
            <div className="column">
              <label>Scheduled to run</label>
              <h3>
                {state.job.next_scheduled_time
                  ? formatServerDateTime(state.job.next_scheduled_time)
                  : formatServerDateTime(state.job.last_scheduled_time)}
              </h3>
            </div>
            <div className="clear"></div>
          </div>
        </div>

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
          onChange={onSelectSubview.bind(this)}
        />

        <div className="tab-view">{tabView}</div>

        <div className="separated">
          <MDCButtonReact
            disabled={state.refreshing}
            label="Refresh"
            icon="refresh"
            onClick={reload.bind(this)}
          />

          {state.job.schedule !== null &&
            ["STARTED", "PENDING"].includes(state.job.status) && (
              <MDCButtonReact
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={editJob.bind(this)}
                icon="tune"
                label="Edit"
              />
            )}

          {["STARTED", "PENDING"].includes(state.job.status) && (
            <MDCButtonReact
              classNames={["mdc-button--raised"]}
              label="Cancel job"
              icon="close"
              onClick={cancelJob.bind(this)}
            />
          )}
        </div>
      </div>
    );
  }

  return <div className="view-page job-view">{rootView}</div>;
};

export default JobView;
