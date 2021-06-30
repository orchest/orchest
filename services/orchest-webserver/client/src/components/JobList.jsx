// @ts-check
import React, { Fragment } from "react";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
  MDCSelectReact,
  MDCLinearProgressReact,
  MDCDialogReact,
} from "@orchest/lib-mdc";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "@orchest/lib-utils";

import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import EditJobView from "@/views/EditJobView";
import JobView from "@/views/JobView";
import ProjectsView from "@/views/ProjectsView";

import SearchableTable from "./SearchableTable";
import { StatusInline } from "./Status";

/**
 * @typedef {{ project_uuid: string; }} TJobListProps
 *
 * @type React.FC<TJobListProps>
 */
const JobList = (props) => {
  const [state, setState] = React.useState({
    deleting: false,
    createModal: false,
    createModelLoading: false,
    jobs: undefined,
    pipelines: undefined,
    jobsSearchMask: new Array(0).fill(1),
    projectSnapshotSize: undefined,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const { orchest } = window;

  const fetchList = () => {
    // in case jobTable exists, clear checks
    if (refManager.refs.jobTable) {
      refManager.refs.jobTable.setSelectedRowIds([]);
    }

    let fetchListPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/jobs/?project_uuid=${props.project_uuid}`
      ),
      promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          jobs: result["jobs"],
          jobsSearchMask: new Array(result.length).fill(1),
        }));
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const fetchProjectDirSize = () => {
    let fetchProjectDirSizePromise = makeCancelable(
      makeRequest("GET", `/async/projects/${props.project_uuid}`),
      promiseManager
    );

    fetchProjectDirSizePromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          projectSnapshotSize: result["project_snapshot_size"],
        }));
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const onCreateClick = () => {
    if (state.pipelines !== undefined && state.pipelines.length > 0) {
      setState((prevState) => ({
        ...prevState,
        createModal: true,
      }));
    } else {
      orchest.alert("Error", "Could not find any pipelines for this project.");
    }
  };

  const onDeleteClick = () => {
    if (!state.deleting) {
      setState((prevState) => ({
        ...prevState,
        deleting: true,
      }));

      // get job selection
      let selectedRows = refManager.refs.jobTable.getSelectedRowIndices();

      if (selectedRows.length == 0) {
        orchest.alert("Error", "You haven't selected any jobs.");
        return;
      }

      orchest.confirm(
        "Warning",
        "Are you sure you want to delete these jobs? (This cannot be undone.)",
        () => {
          // delete indices
          let promises = [];

          for (let x = 0; x < selectedRows.length; x++) {
            promises.push(
              // deleting the job will also
              // take care of aborting it if necessary
              makeRequest(
                "DELETE",
                "/catch/api-proxy/api/jobs/cleanup/" +
                  state.jobs[selectedRows[x]].uuid
              )
            );
          }

          Promise.all(promises).then(() => {
            fetchList();
            refManager.refs.jobTable.setSelectedRowIds([]);
          });

          setState((prevState) => ({
            ...prevState,
            deleting: false,
          }));
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            deleting: false,
          }));
        }
      );
    }
  };

  const onSubmitModal = () => {
    let jobName = refManager.refs.formJobName.mdc.value;

    let pipeline_uuid = refManager.refs.formPipeline.mdc.value;
    let pipelineName;
    for (let x = 0; x < state.pipelines.length; x++) {
      if (state.pipelines[x].uuid === pipeline_uuid) {
        pipelineName = state.pipelines[x].name;
        break;
      }
    }

    if (jobName.length == 0) {
      orchest.alert("Error", "Please enter a name for your job.");
      return;
    }

    if (refManager.refs.formPipeline.mdc.value == "") {
      orchest.alert("Error", "Please choose a pipeline.");
      return;
    }

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    setState((prevState) => ({
      ...prevState,
      createModelLoading: true,
    }));

    checkGate(props.project_uuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/", {
            type: "json",
            content: {
              pipeline_uuid: pipeline_uuid,
              pipeline_name: pipelineName,
              project_uuid: props.project_uuid,
              name: jobName,
              draft: true,
              pipeline_run_spec: {
                run_type: "full",
                uuids: [],
              },
              parameters: [],
            },
          }),
          promiseManager
        );

        postJobPromise.promise
          .then((response) => {
            let job = JSON.parse(response);

            orchest.loadView(EditJobView, {
              queryArgs: {
                job_uuid: job.uuid,
              },
            });
          })
          .catch((response) => {
            if (!response.isCanceled) {
              try {
                let result = JSON.parse(response.body);
                orchest.alert(
                  "Error",
                  "Failed to create job. " + result.message
                );

                setState((prevState) => ({
                  ...prevState,
                  createModelLoading: false,
                }));
              } catch (error) {
                console.log(error);
              }
            }
          });
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          orchest.requestBuild(
            props.project_uuid,
            result.data,
            "CreateJob",
            () => {
              onSubmitModal();
            }
          );
        }
      });
  };

  const onCancelModal = () => {
    refManager.refs.createJobDialog.close();
  };

  const onCloseCreateJobModal = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: false,
    }));
  };

  const onRowClick = (row, idx, event) => {
    let job = state.jobs[idx];

    if (job.status === "DRAFT") {
      orchest.loadView(EditJobView, {
        queryArgs: {
          job_uuid: job.uuid,
        },
      });
    } else {
      orchest.loadView(JobView, {
        queryArgs: {
          job_uuid: job.uuid,
        },
      });
    }
  };

  const jobListToTableData = (jobs) => {
    let rows = [];
    for (let x = 0; x < jobs.length; x++) {
      // keep only jobs that are related to a project!
      rows.push([
        jobs[x].name,
        jobs[x].pipeline_name,
        formatServerDateTime(jobs[x].created_time),
        <StatusInline
          css={{ verticalAlign: "bottom" }}
          status={jobs[x].status}
        />,
      ]);
    }
    return rows;
  };

  const generatePipelineOptions = (pipelines) => {
    let pipelineOptions = [];

    for (let x = 0; x < pipelines.length; x++) {
      pipelineOptions.push([pipelines[x].uuid, pipelines[x].name]);
    }

    return pipelineOptions;
  };

  React.useEffect(() => {
    // retrieve pipelines once on component render
    let pipelinePromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${props.project_uuid}`),
      promiseManager
    );

    pipelinePromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          pipelines: result.result,
        }));
      })
      .catch((e) => {
        if (e && e.status == 404) {
          orchest.loadView(ProjectsView);
        }
        console.log(e);
      });

    // retrieve jobs
    fetchList();
    // get size of project dir to show warning if necessary
    fetchProjectDirSize();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  return (
    <div className={"jobs-page"}>
      <h2>Jobs</h2>

      {(() => {
        if (state.jobs && state.pipelines) {
          return (
            <Fragment>
              {(() => {
                if (state.createModal) {
                  let pipelineOptions = generatePipelineOptions(
                    state.pipelines
                  );

                  return (
                    <MDCDialogReact
                      title="Create a new job"
                      ref={refManager.nrefs.createJobDialog}
                      onClose={onCloseCreateJobModal.bind(this)}
                      content={
                        <Fragment>
                          <div className="create-job-modal">
                            {(() => {
                              // display warning if snapshot size would exceed 50MB
                              if (state.projectSnapshotSize > 50) {
                                return (
                                  <div className="warning push-down">
                                    <i className="material-icons">warning</i>{" "}
                                    Snapshot size exceeds 50MB. Please refer to
                                    the{" "}
                                    <a href="https://orchest.readthedocs.io/en/latest/user_guide/jobs.html">
                                      docs
                                    </a>
                                    .
                                  </div>
                                );
                              }
                            })()}

                            <MDCTextFieldReact
                              ref={refManager.nrefs.formJobName}
                              classNames={["fullwidth push-down"]}
                              label="Job name"
                            />

                            <MDCSelectReact
                              ref={refManager.nrefs.formPipeline}
                              label="Pipeline"
                              classNames={["fullwidth"]}
                              value={pipelineOptions[0][0]}
                              options={pipelineOptions}
                            />

                            {(() => {
                              if (state.createModelLoading) {
                                return (
                                  <Fragment>
                                    <MDCLinearProgressReact />
                                    <p>Copying pipeline directory...</p>
                                  </Fragment>
                                );
                              }
                            })()}
                          </div>
                        </Fragment>
                      }
                      actions={
                        <Fragment>
                          <MDCButtonReact
                            icon="close"
                            classNames={["push-right"]}
                            label="Cancel"
                            onClick={onCancelModal.bind(this)}
                          />
                          <MDCButtonReact
                            disabled={state.createModelLoading}
                            icon="add"
                            classNames={[
                              "mdc-button--raised",
                              "themed-secondary",
                            ]}
                            label="Create job"
                            submitButton
                            onClick={onSubmitModal.bind(this)}
                          />
                        </Fragment>
                      }
                    />
                  );
                }
              })()}
              <div className="push-down">
                <MDCButtonReact
                  icon="add"
                  label="Create job"
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  onClick={onCreateClick.bind(this)}
                />
              </div>

              <div className={"job-actions"}>
                <MDCIconButtonToggleReact
                  icon="delete"
                  tooltipText="Delete job"
                  onClick={onDeleteClick.bind(this)}
                />
              </div>

              <SearchableTable
                ref={refManager.nrefs.jobTable}
                selectable={true}
                onRowClick={onRowClick.bind(this)}
                rows={jobListToTableData(state.jobs)}
                headers={["Job", "Pipeline", "Snapshot date", "Status"]}
              />
            </Fragment>
          );
        } else {
          return <MDCLinearProgressReact />;
        }
      })()}
    </div>
  );
};

export default JobList;
