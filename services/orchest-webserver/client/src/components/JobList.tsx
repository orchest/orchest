import * as React from "react";
import {
  Box,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DIALOG_ANIMATION_DURATION,
} from "@orchest/design-system";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
  MDCSelectReact,
  MDCLinearProgressReact,
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

export interface IJobListProps {
  project_uuid: string;
}

const JobList: React.FC<IJobListProps> = (props) => {
  const [state, setState] = React.useState({
    deleting: false,
    jobs: undefined,
    pipelines: undefined,
    projectSnapshotSize: undefined,
  });

  const [isCreateDialogLoading, setIsCreateDialogLoading] = React.useState(
    false
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

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
          jobs: result.jobs,
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
      setIsCreateDialogOpen(true);
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

  const onSubmitModal = (
    rerun?: Record<
      "pipeline_uuid" | "pipeline_name" | "project_uuid" | "name",
      string
    >
  ) => {
    if (!rerun) {
      if (refManager.refs.formJobName.mdc.value.length == 0) {
        orchest.alert("Error", "Please enter a name for your job.");
        return;
      }

      if (refManager.refs.formPipeline.mdc.value == "") {
        orchest.alert("Error", "Please choose a pipeline.");
        return;
      }
    }

    const name = rerun?.name || refManager.refs.formJobName.mdc.value;
    const pipeline_uuid =
      rerun?.pipeline_uuid || refManager.refs.formPipeline.mdc.value;
    const pipeline_name =
      rerun?.pipeline_name ||
      state.pipelines.find((pipeline) => pipeline.uuid === pipeline_uuid)?.name;
    const project_uuid = rerun?.project_uuid || props.project_uuid;

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    setIsCreateDialogLoading(true);

    checkGate(props.project_uuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/", {
            type: "json",
            content: {
              pipeline_uuid,
              pipeline_name,
              project_uuid,
              name,
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

                setIsCreateDialogOpen(false);

                setTimeout(() => {
                  setIsCreateDialogLoading(false);

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
          setIsCreateDialogOpen(false);

          setTimeout(() => {
            setIsCreateDialogLoading(false);

            orchest.requestBuild(
              props.project_uuid,
              result.data,
              "CreateJob",
              () => {
                setIsCreateDialogOpen(true);
                onSubmitModal({
                  name,
                  pipeline_name,
                  pipeline_uuid,
                  project_uuid,
                });
              }
            );
          }, DIALOG_ANIMATION_DURATION.OUT);
        }
      });
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

  const pipelineOptions =
    state.pipelines?.map(({ uuid, name }) => [uuid, name]) || [];

  return (
    <div className={"jobs-page"}>
      <h2>Jobs</h2>

      {state.jobs && state.pipelines ? (
        <React.Fragment>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => setIsCreateDialogOpen(open)}
          >
            <div className="push-down">
              <MDCButtonReact
                icon="add"
                label="Create job"
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={() => onCreateClick()}
              />
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new job</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <form
                  id="create-job"
                  className="create-job-modal"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    onSubmitModal();
                  }}
                >
                  {isCreateDialogLoading ? (
                    <Box
                      css={{ margin: "$2 0", "> * + *": { marginTop: "$5" } }}
                    >
                      <MDCLinearProgressReact />

                      <p>Copying pipeline directory...</p>
                    </Box>
                  ) : (
                    <React.Fragment>
                      {state.projectSnapshotSize > 50 && (
                        <div className="warning push-down">
                          <i className="material-icons">warning</i> Snapshot
                          size exceeds 50MB. Please refer to the{" "}
                          <a href="https://orchest.readthedocs.io/en/latest/user_guide/jobs.html">
                            docs
                          </a>
                          .
                        </div>
                      )}

                      <MDCTextFieldReact
                        ref={refManager.nrefs.formJobName}
                        classNames={["fullwidth push-down"]}
                        label="Job name"
                      />

                      <MDCSelectReact
                        ref={refManager.nrefs.formPipeline}
                        label="Pipeline"
                        classNames={["fullwidth"]}
                        value={
                          pipelineOptions &&
                          pipelineOptions[0] &&
                          pipelineOptions[0][0]
                        }
                        options={pipelineOptions}
                      />
                    </React.Fragment>
                  )}
                </form>
              </DialogBody>
              <DialogFooter>
                <MDCButtonReact
                  icon="close"
                  classNames={["push-right"]}
                  label="Cancel"
                  onClick={() => setIsCreateDialogOpen(false)}
                />
                <MDCButtonReact
                  disabled={isCreateDialogLoading}
                  icon="add"
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  label="Create job"
                  submitButton
                  inputType="submit"
                  form="create-job"
                />
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
        </React.Fragment>
      ) : (
        <MDCLinearProgressReact />
      )}
    </div>
  );
};

export default JobList;
