import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Job } from "@/types";
import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
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
  const { setAlert, setConfirm, requestBuild } = useAppContext();

  const [isEditingJobName, setIsEditingJobName] = React.useState(false);
  const [isSubmittingJobName, setIsSubmittingJobName] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");

  const [jobs, setJobs] = React.useState<Job[] | undefined>();
  const [pipelines, setPipelines] = React.useState<
    { uuid: string; path: string; name: string }[]
  >([]);
  const [selectedPipeline, setSelectedPipeline] = React.useState<
    string | undefined
  >();

  const [projectSnapshotSize, setProjectSnapshotSize] = React.useState(0);

  const [isCreatingJob, setIsCreatingJob] = React.useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const promiseManager = React.useRef(new PromiseManager());
  const refManager = React.useRef(new RefManager());

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
      setJobName("");
    } else {
      setAlert("Error", "Could not find any pipelines for this project.");
    }
  };

  const onDeleteClick = () => {
    if (!isDeleting) {
      setIsDeleting(true);

      // get job selection
      let selectedRows = refManager.current.refs.jobTable.getSelectedRowIndices();

      if (selectedRows.length == 0) {
        setAlert("Error", "You haven't selected any jobs.");
        setIsDeleting(false);

        return;
      }

      setConfirm(
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

  const createJob = (newJobName: string, pipelineUuid: string) => {
    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    setIsCreatingJob(true);

    const pipelineName = pipelines.find(
      (pipeline) => pipeline.uuid === pipelineUuid
    )?.name;

    checkGate(projectUuid)
      .then(() => {
        let postJobPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/jobs/", {
            type: "json",
            content: {
              pipeline_uuid: pipelineUuid,
              project_uuid: projectUuid,
              pipeline_name: pipelineName, // ? Question: why pipeline_name is needed when pipeline_uuid is given?
              name: newJobName,
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
                setAlert("Error", `Failed to create job. ${result.message}`);
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

          requestBuild(projectUuid, result.data, "CreateJob", () => {
            setIsCreateDialogOpen(true);
            createJob(newJobName, pipelineUuid);
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
    setJobName("");
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
          <IconButton
            onClick={() => {
              onEditJobNameClick(job.uuid, job.name);
            }}
          >
            <EditIcon />
          </IconButton>
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

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setJobName("");
    setSelectedPipeline(undefined);
  };

  return (
    <div className={"jobs-page"}>
      <Dialog open={isEditingJobName} onClose={onCloseEditJobNameModal}>
        <DialogTitle>Edit job name</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            value={jobName}
            label="Job name"
            onChange={(e) => setJobName(e.target.value)}
            data-test-id="job-edit-name-textfield"
          />
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} onClick={onCloseEditJobNameModal}>
            Cancel
          </Button>
          <Button
            startIcon={<SaveIcon />}
            disabled={isSubmittingJobName}
            variant="contained"
            onClick={onSubmitEditJobNameModal}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <h2>Jobs</h2>

      {jobs && pipelines ? (
        <>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={onCreateClick}
            sx={{ marginBottom: (theme) => theme.spacing(2) }}
            data-test-id="job-create"
          >
            Create job
          </Button>
          <Dialog
            open={isCreateDialogOpen}
            onClose={closeCreateDialog}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle>Create a new job</DialogTitle>
            <DialogContent>
              <form
                id="create-job"
                className="create-job-modal"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  if (jobName.length === 0) {
                    setAlert("Error", "Please enter a name for your job.");
                    return;
                  }

                  if (!selectedPipeline) {
                    setAlert("Error", "Please choose a pipeline.");
                    return;
                  }

                  createJob(jobName, selectedPipeline);
                }}
              >
                {isCreatingJob ? (
                  <Box sx={{ margin: "$2 0", "> * + *": { marginTop: "$5" } }}>
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

                    <FormControl fullWidth>
                      <TextField
                        margin="normal"
                        value={jobName}
                        onChange={(e) => setJobName(e.target.value)}
                        label="Job name"
                        data-test-id="job-create-name"
                      />
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel id="select-pipeline-label">
                        Pipeline
                      </InputLabel>
                      <Select
                        labelId="select-pipeline-label"
                        id="select-pipeline"
                        value={selectedPipeline}
                        label="Pipeline"
                        onChange={(e) => {
                          setSelectedPipeline(e.target.value);
                        }}
                      >
                        {pipelines.map((pipeline) => {
                          return (
                            <MenuItem key={pipeline.uuid} value={pipeline.uuid}>
                              {pipeline.name}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </>
                )}
              </form>
            </DialogContent>
            <DialogActions>
              <Button startIcon={<CloseIcon />} onClick={closeCreateDialog}>
                Cancel
              </Button>
              <Button
                disabled={isCreatingJob}
                startIcon={<AddIcon />}
                variant="contained"
                type="submit"
                form="create-job"
                data-test-id="job-create-ok"
              >
                Create job
              </Button>
            </DialogActions>
          </Dialog>

          <div className={"job-actions"}>
            <Tooltip title="Delete job">
              <IconButton
                color="secondary"
                disabled={isDeleting}
                onClick={onDeleteClick}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
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
