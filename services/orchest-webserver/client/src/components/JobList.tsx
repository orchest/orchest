import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Job } from "@/types";
import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import { Box } from "@orchest/design-system";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCSelectReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import React from "react";
import SearchableTable from "./SearchableTable";
import { StatusInline } from "./Status";

export interface IJobListProps {
  projectUuid: string;
}

const JobList: React.FC<IJobListProps> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const [isEditingJobName, setIsEditingJobName] = React.useState(false);
  const [isSubmittingJobName, setIsSubmittingJobName] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");

  const [jobs, setJobs] = React.useState<Job[] | undefined>();
  const [pipelines, setPipelines] = React.useState<any[] | undefined>();

  const [projectSnapshotSize, setProjectSnapshotSize] = React.useState(0);

  const [isCreatingJob, setIsCreatingJob] = React.useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const promiseManager = React.useRef(new PromiseManager());
  const refManager = React.useRef(new RefManager());

  const { orchest } = window;

  const fetchList = () => {
    // in case jobTable exists, clear checks
    if (refManager.current.refs.jobTable) {
      refManager.current.refs.jobTable.setSelectedRowIds([]);
    }

    let fetchListPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      ),
      promiseManager.current
    );

    fetchListPromise.promise
      .then((response: string) => {
        let result = JSON.parse(response);
        setJobs(result.jobs);
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const fetchProjectDirSize = () => {
    let fetchProjectDirSizePromise = makeCancelable(
      makeRequest("GET", `/async/projects/${projectUuid}`),
      promiseManager.current
    );

    fetchProjectDirSizePromise.promise
      .then((response: string) => {
        let result = JSON.parse(response);
        setProjectSnapshotSize(result["project_snapshot_size"]);
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const onCreateClick = () => {
    if (pipelines !== undefined && pipelines.length > 0) {
      setIsCreateDialogOpen(true);
    } else {
      orchest.alert("Error", "Could not find any pipelines for this project.");
    }
  };

  const onDeleteClick = () => {
    if (!isDeleting) {
      setIsDeleting(true);

      // get job selection
      let selectedRows = refManager.current.refs.jobTable.getSelectedRowIndices();

      if (selectedRows.length == 0) {
        orchest.alert("Error", "You haven't selected any jobs.");
        setIsDeleting(true);

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
                  jobs[selectedRows[x]].uuid
              )
            );
          }

          Promise.all(promises)
            .then(() => {
              setIsDeleting(false);

              fetchList();
              refManager.current.refs.jobTable.setSelectedRowIds([]);
            })
            .catch(() => {
              setIsDeleting(false);
            });
        },
        () => {
          setIsDeleting(false);
        }
      );
    } else {
      console.error("Delete UI in progress.");
    }
  };

  const onSubmitModal = (
    rerun?: Record<
      "pipelineUuid" | "pipelineName" | "projectUuid" | "name",
      string
    >
  ) => {
    if (!rerun) {
      if (refManager.current.refs.formJobName.mdc.value.length == 0) {
        orchest.alert("Error", "Please enter a name for your job.");
        return;
      }

      if (refManager.current.refs.formPipeline.mdc.value == "") {
        orchest.alert("Error", "Please choose a pipeline.");
        return;
      }
    }

    const name = rerun?.name || refManager.current.refs.formJobName.mdc.value;
    const pipelineUuid =
      rerun?.pipelineUuid || refManager.current.refs.formPipeline.mdc.value;
    const pipelineName =
      rerun?.pipelineName ||
      (pipelines || []).find((pipeline) => pipeline.uuid === pipelineUuid)
        ?.name;

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    setIsCreatingJob(true);

    checkGate(projectUuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/", {
            type: "json",
            content: {
              pipeline_uuid: pipelineUuid,
              pipeline_name: pipelineName,
              project_uuid: projectUuid,
              name,
              draft: true,
              pipeline_run_spec: {
                run_type: "full",
                uuids: [],
              },
              parameters: [],
            },
          }),
          promiseManager.current
        );

        postJobPromise.promise
          .then((response: string) => {
            let job = JSON.parse(response);
            navigateTo(siteMap.editJob.path, {
              query: {
                projectUuid,
                jobUuid: job.uuid,
              },
            });
          })
          .catch((response) => {
            if (!response.isCanceled) {
              try {
                let result = JSON.parse(response.body);

                setIsCreateDialogOpen(false);
                setIsCreatingJob(false);
                orchest.alert(
                  "Error",
                  "Failed to create job. " + result.message
                );
              } catch (error) {
                console.log(error);
              }
            }
          });
      })
      .catch((result) => {
        if (result.reason === "gate-failed") {
          setIsCreateDialogOpen(false);
          setIsCreatingJob(false);

          orchest.requestBuild(projectUuid, result.data, "CreateJob", () => {
            setIsCreateDialogOpen(true);
            onSubmitModal({
              name,
              pipelineName,
              pipelineUuid,
              projectUuid,
            });
          });
        }
      });
  };

  const onRowClick = (row, idx, event) => {
    let job = jobs[idx];

    navigateTo(
      job.status === "DRAFT" ? siteMap.editJob.path : siteMap.job.path,
      {
        query: {
          projectUuid,
          jobUuid: job.uuid,
        },
      }
    );
  };

  const onEditJobNameClick = (newJobUuid: string, newJobName: string) => {
    setIsEditingJobName(true);
    setJobName(newJobName);
    setJobUuid(newJobUuid);
  };

  const onCloseEditJobNameModal = () => {
    setIsSubmittingJobName(false);
    setIsEditingJobName(false);
  };

  const onSubmitEditJobNameModal = () => {
    setIsSubmittingJobName(true);

    makeRequest("PUT", `/catch/api-proxy/api/jobs/${jobUuid}`, {
      type: "json",
      content: { name: jobName },
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

  const transformedJobs = (jobs || []).map((job) => {
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

  React.useEffect(() => {
    // retrieve pipelines once on component render
    let pipelinePromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${projectUuid}`),
      promiseManager.current
    );

    pipelinePromise.promise
      .then((response: string) => {
        let result = JSON.parse(response);
        setPipelines(result.result);
      })
      .catch((e) => {
        if (e && e.status == 404) {
          navigateTo(siteMap.projects.path);
        }
        console.log(e);
      });

    // retrieve jobs
    fetchList();
    // get size of project dir to show warning if necessary
    fetchProjectDirSize();

    return () => promiseManager.current.cancelCancelablePromises();
  }, [projectUuid]);

  const pipelineOptions = (pipelines || []).map(({ uuid, name }) => [
    uuid,
    name,
  ]);

  return (
    <div className={"jobs-page"}>
      {isEditingJobName && (
        <Dialog open={true} onClose={onCloseEditJobNameModal}>
          <DialogTitle>Edit job name</DialogTitle>
          <DialogContent>
            <MDCTextFieldReact
              classNames={["fullwidth push-down"]}
              value={jobName}
              label="Job name"
              onChange={(value: string) => {
                setJobName(value);
              }}
              data-test-id="job-edit-name-textfield"
            />
          </DialogContent>
          <DialogActions>
            <MDCButtonReact
              icon="close"
              label="Cancel"
              classNames={["push-right"]}
              onClick={onCloseEditJobNameModal}
            />
            <MDCButtonReact
              icon="save"
              disabled={isSubmittingJobName}
              classNames={["mdc-button--raised", "themed-secondary"]}
              label="Save"
              submitButton
              onClick={onSubmitEditJobNameModal}
            />
          </DialogActions>
        </Dialog>
      )}

      <h2>Jobs</h2>

      {jobs && pipelines ? (
        <>
          <div className="push-down">
            <MDCButtonReact
              icon="add"
              label="Create job"
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={() => onCreateClick()}
              data-test-id="job-create"
            />
          </div>
          <Dialog open={isCreateDialogOpen}>
            <DialogTitle>Create a new job</DialogTitle>
            <DialogContent>
              <form
                id="create-job"
                className="create-job-modal"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  onSubmitModal();
                }}
              >
                {isCreatingJob ? (
                  <Box css={{ margin: "$2 0", "> * + *": { marginTop: "$5" } }}>
                    <LinearProgress />

                    <p>Copying pipeline directory...</p>
                  </Box>
                ) : (
                  <>
                    {projectSnapshotSize > 50 && (
                      <div className="warning push-down">
                        <i className="material-icons">warning</i> Snapshot size
                        exceeds 50MB. Please refer to the{" "}
                        <a href="https://docs.orchest.io/en/latest/user_guide/jobs.html">
                          docs
                        </a>
                        .
                      </div>
                    )}

                    <MDCTextFieldReact
                      ref={refManager.current.nrefs.formJobName}
                      classNames={["fullwidth push-down"]}
                      label="Job name"
                      data-test-id="job-create-name"
                    />

                    <MDCSelectReact
                      ref={refManager.current.nrefs.formPipeline}
                      label="Pipeline"
                      classNames={["fullwidth"]}
                      value={
                        pipelineOptions &&
                        pipelineOptions[0] &&
                        pipelineOptions[0][0]
                      }
                      options={pipelineOptions}
                    />
                  </>
                )}
              </form>
              <DialogActions>
                <MDCButtonReact
                  icon="close"
                  classNames={["push-right"]}
                  label="Cancel"
                  onClick={() => setIsCreateDialogOpen(false)}
                />
                <MDCButtonReact
                  disabled={isCreatingJob}
                  icon="add"
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  label="Create job"
                  submitButton
                  inputType="submit"
                  form="create-job"
                  data-test-id="job-create-ok"
                />
              </DialogActions>
            </DialogContent>
          </Dialog>

          <div className={"job-actions"}>
            <MDCIconButtonToggleReact
              icon="delete"
              tooltipText="Delete job"
              disabled={isDeleting}
              onClick={onDeleteClick}
            />
          </div>

          <SearchableTable
            ref={refManager.current.nrefs.jobTable}
            selectable={true}
            onRowClick={onRowClick}
            rows={transformedJobs}
            headers={["Job", "Pipeline", "Snapshot date", "Status"]}
          />
        </>
      ) : (
        <LinearProgress />
      )}
    </div>
  );
};

export default JobList;
