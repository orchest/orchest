import React from "react";
import { useHistory } from "react-router-dom";
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
  MDCDialogReact,
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

import { siteMap, generatePathFromRoute } from "../Routes";

import SearchableTable from "./SearchableTable";
import { StatusInline } from "./Status";

export interface IJobListProps {
  projectId: string;
}

const JobList: React.FC<IJobListProps> = (props) => {
  const history = useHistory<{ isDraft: boolean }>();
  const [state, setState] = React.useState({
    isDeleting: false,
    jobs: undefined,
    pipelines: undefined,
    projectSnapshotSize: undefined,
    editJobNameModal: false,
    editJobNameModalBusy: false,
    editJobName: undefined,
    editJobNameUUID: undefined,
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
        `/catch/api-proxy/api/jobs/?project_uuid=${props.projectId}`
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
      makeRequest("GET", `/async/projects/${props.projectId}`),
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
    if (!state.isDeleting) {
      setState((prevState) => ({
        ...prevState,
        isDeleting: true,
      }));

      // get job selection
      let selectedRows = refManager.refs.jobTable.getSelectedRowIndices();

      if (selectedRows.length == 0) {
        orchest.alert("Error", "You haven't selected any jobs.");

        setState((prevState) => ({
          ...prevState,
          isDeleting: true,
        }));
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

          Promise.all(promises)
            .then(() => {
              setState((prevState) => ({
                ...prevState,
                isDeleting: false,
              }));

              fetchList();
              refManager.refs.jobTable.setSelectedRowIds([]);
            })
            .catch(() => {
              setState((prevState) => ({
                ...prevState,
                isDeleting: false,
              }));
            });
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        }
      );
    } else {
      console.error("Delete UI in progress.");
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
    const project_uuid = rerun?.project_uuid || props.projectId;

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    setIsCreateDialogLoading(true);

    checkGate(props.projectId)
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
            history.push(
              generatePathFromRoute(siteMap.job.path, {
                projectId: project_uuid,
                jobId: job.uuid,
              })
            );
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
              props.projectId,
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
    // const ViewToLoad = job.status === "DRAFT" ? EditJobView : JobView;

    // TODO: can we combine JobView and EditJobView?
    // JobView should be able to determine the job status, without us passing the query string
    // otherwise, user might accidentally change the query string and mess around jobs

    history.push(
      generatePathFromRoute(siteMap.job.path, {
        projectId: props.projectId,
        jobId: job.uuid,
      }),
      {
        isDraft: job.status === "DRAFT",
      } // TODO: JobView should use useLocation to get state.isDraft
    );
  };

  const onEditJobNameClick = (jobUUID, jobName) => {
    setState((prevState) => ({
      ...prevState,
      editJobName: jobName,
      editJobNameUUID: jobUUID,
      editJobNameModal: true,
    }));
  };

  const onCloseEditJobNameModal = () => {
    setState((prevState) => ({
      ...prevState,
      editJobNameModal: false,
      editJobNameModalBusy: false,
    }));
  };

  const onSubmitEditJobNameModal = () => {
    setState((prevState) => ({
      ...prevState,
      editJobNameModalBusy: true,
    }));

    makeRequest("PUT", `/catch/api-proxy/api/jobs/${state.editJobNameUUID}`, {
      type: "json",
      content: {
        name: state.editJobName,
      },
    })
      .then((_) => {
        fetchList();
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        onCloseEditJobNameModal();
      });
  };

  const jobListToTableData = (jobs) => {
    let rows = jobs.map((job) => {
      // keep only jobs that are related to a project!
      return [
        <span
          className="mdc-icon-table-wrapper"
          key={`job-${job.name}`}
          data-test-id={`job-${job.name}`}
        >
          {job.name}{" "}
          <span className="consume-click">
            <MDCIconButtonToggleReact
              icon="edit"
              onClick={() => {
                onEditJobNameClick(job.uuid, job.name);
              }}
            />
          </span>
        </span>,
        job.pipeline_name,
        formatServerDateTime(job.created_time),
        <StatusInline
          key={`${job.name}-status`}
          css={{ verticalAlign: "bottom" }}
          status={job.status}
        />,
      ];
    });

    return rows;
  };

  React.useEffect(() => {
    // retrieve pipelines once on component render
    let pipelinePromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${props.projectId}`),
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
          history.push(siteMap.projects.path);
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
      {state.editJobNameModal && (
        <MDCDialogReact
          title="Edit job name"
          onClose={onCloseEditJobNameModal}
          content={
            <React.Fragment>
              <MDCTextFieldReact
                classNames={["fullwidth push-down"]}
                value={state.editJobName}
                label="Job name"
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    editJobName: value,
                  }));
                }}
                data-test-id="job-edit-name-textfield"
              />
            </React.Fragment>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                icon="close"
                label="Cancel"
                classNames={["push-right"]}
                onClick={onCloseEditJobNameModal}
              />
              <MDCButtonReact
                icon="save"
                disabled={state.editJobNameModalBusy}
                classNames={["mdc-button--raised", "themed-secondary"]}
                label="Save"
                submitButton
                onClick={onSubmitEditJobNameModal}
              />
            </React.Fragment>
          }
        />
      )}

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
                data-test-id="job-create"
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
                        data-test-id="job-create-name"
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
                  data-test-id="job-create-ok"
                />
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className={"job-actions"}>
            <MDCIconButtonToggleReact
              icon="delete"
              tooltipText="Delete job"
              disabled={state.isDeleting}
              onClick={onDeleteClick}
            />
          </div>

          <SearchableTable
            ref={refManager.nrefs.jobTable}
            selectable={true}
            onRowClick={onRowClick}
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
