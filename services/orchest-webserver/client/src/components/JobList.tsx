import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Job, JobStatus, Project } from "@/types";
import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { darken } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import {
  fetcher,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import { DataTable, DataTableColumn } from "./DataTable";
import { StatusInline } from "./Status";

type DisplayedJob = {
  name: string;
  pipeline: string;
  snapShotDate: string;
  status: JobStatus;
};

const createColumns = ({
  onEditJobNameClick,
}: {
  onEditJobNameClick: (uuid: string, name: string) => void;
}): DataTableColumn<DisplayedJob>[] => [
  {
    id: "name",
    label: "Job",
    render: (row) => (
      <Tooltip title="Edit job name">
        <Stack
          direction="row"
          alignItems="center"
          component="span"
          sx={{
            display: "inline-flex",
            svg: { visibility: "hidden" },
            "&:hover": {
              color: (theme) => darken(theme.palette.primary.main, 0.15),
              // textDecoration: "underline",
              svg: { visibility: "visible" },
            },
          }}
          onClick={(e: React.MouseEvent<unknown>) => {
            e.stopPropagation();
            onEditJobNameClick(row.uuid, row.name);
          }}
        >
          {row.name}
          <EditIcon
            sx={{
              width: (theme) => theme.spacing(2),
              marginLeft: (theme) => theme.spacing(1),
            }}
            color="primary"
          />
        </Stack>
      </Tooltip>
    ),
  },
  { id: "pipeline", label: "Pipeline" },
  { id: "snapShotDate", label: "Snapshot date" },
  {
    id: "status",
    label: "Status",
    render: (row) => <StatusInline status={row.status} />,
  },
];

const JobList: React.FC<{ projectUuid: string }> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm, requestBuild } = useAppContext();

  const [isEditingJobName, setIsEditingJobName] = React.useState(false);
  const [isSubmittingJobName, setIsSubmittingJobName] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");

  const [jobs, setJobs] = React.useState<Job[]>([]);
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

  const fetchJobs = async () => {
    try {
      const response = await fetcher<{ jobs: Job[] }>(
        `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      );
      setJobs(response.jobs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjectDirSize = async () => {
    try {
      const result = await fetcher<Project>(`/async/projects/${projectUuid}`);
      setProjectSnapshotSize(result.project_snapshot_size);
    } catch (e) {
      // handle this error silently
      console.error(e);
    }
  };

  const onCreateClick = () => {
    if (pipelines !== undefined && pipelines.length > 0) {
      setIsCreateDialogOpen(true);
      setJobName("");
    } else {
      setAlert("Error", "Could not find any pipelines for this project.");
    }
  };

  const deleteSelectedJobs = (jobUuids: string[]) => {
    // this is just a precaution. the button is disabled when isDeleting is true.
    if (isDeleting) {
      console.error("Delete UI in progress.");
      return;
    }

    setIsDeleting(true);

    if (jobUuids.length == 0) {
      setAlert("Error", "You haven't selected any jobs.");
      setIsDeleting(false);

      return;
    }

    setConfirm(
      "Warning",
      "Are you sure you want to delete these jobs? (This cannot be undone.)",
      async () => {
        const promises = jobUuids.map((uuid) => {
          return fetcher(`/catch/api-proxy/api/jobs/cleanup/${uuid}`, {
            method: "DELETE",
          });
        });

        try {
          await Promise.all(promises);
          setIsDeleting(false);
          fetchJobs();
        } catch (e) {
          setAlert("Error", `Failed to delete selected jobs: ${e}`);
          setIsDeleting(false);
        }
      },
      () => setIsDeleting(false)
    );
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

  const onRowClick = (uuid: string) => {
    const foundJob = jobs.find((job) => job.uuid === uuid);
    if (!foundJob) return;
    navigateTo(
      foundJob.status === "DRAFT" ? siteMap.editJob.path : siteMap.job.path,
      {
        query: {
          projectUuid,
          jobUuid: uuid,
        },
      }
    );
  };

  const columns = React.useMemo(() => {
    const onEditJobNameClick = (newJobUuid: string, newJobName: string) => {
      setIsEditingJobName(true);
      setJobName(newJobName);
      setJobUuid(newJobUuid);
    };
    return createColumns({ onEditJobNameClick });
  }, []);

  const onCloseEditJobNameModal = () => {
    setIsSubmittingJobName(false);
    setIsEditingJobName(false);
    setJobName("");
  };

  const onSubmitEditJobNameModal = async () => {
    setIsSubmittingJobName(true);

    try {
      await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ name: jobName }),
      });
      await fetchJobs();
      onCloseEditJobNameModal();
    } catch (e) {
      setAlert(
        "Error",
        `Failed to update job name: ${JSON.stringify(e)}`,
        onCloseEditJobNameModal
      );
    }
  };

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
    fetchJobs();
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
          <DataTable<DisplayedJob>
            id="job-list"
            selectable
            rows={jobs.map((job) => {
              return {
                uuid: job.uuid,
                name: job.name,
                pipeline: job.pipeline_name,
                snapShotDate: formatServerDateTime(job.created_time),
                status: job.status,
                searchIndex:
                  job.status === "STARTED" ? "Running..." : undefined,
              };
            })}
            columns={columns}
            initialOrderBy="snapShotDate"
            initialOrder="desc"
            onRowClick={onRowClick}
            deleteSelectedRows={deleteSelectedJobs}
          />
        </>
      ) : (
        <LinearProgress />
      )}
    </div>
  );
};

export default JobList;
