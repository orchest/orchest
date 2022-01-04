import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Job, JobStatus, Project } from "@/types";
import { checkGate, formatServerDateTime } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  fetcher,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { IconButton } from "./common/IconButton";
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
    render: function JobName(row) {
      return (
        <Stack
          direction="row"
          alignItems="center"
          component="span"
          sx={{
            display: "inline-flex",
            button: { visibility: "hidden" },
            "&:hover": {
              button: { visibility: "visible" },
            },
          }}
        >
          {row.name}
          <IconButton
            title="Edit job name"
            size="small"
            sx={{ marginLeft: (theme) => theme.spacing(2) }}
            onClick={(e: React.MouseEvent<unknown>) => {
              e.stopPropagation();
              onEditJobNameClick(row.uuid, row.name);
            }}
          >
            <EditIcon />
          </IconButton>
        </Stack>
      );
    },
  },
  { id: "pipeline", label: "Pipeline" },
  { id: "snapShotDate", label: "Snapshot date" },
  {
    id: "status",
    label: "Status",
    render: function SnapshotDate(row) {
      return <StatusInline status={row.status} />;
    },
  },
];

const JobList: React.FC<{ projectUuid: string }> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm, requestBuild } = useAppContext();

  const {
    data: jobs = [],
    error: fetchJobsError,
    isValidating,
    revalidate: fetchJobs,
  } = useSWR(
    projectUuid
      ? `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      : null,
    (url: string) =>
      fetcher<{ jobs: Job[] }>(url).then((response) => response.jobs)
  );

  const [isEditingJobName, setIsEditingJobName] = React.useState(false);
  const [isSubmittingJobName, setIsSubmittingJobName] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");

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

  React.useEffect(() => {
    if (fetchJobsError)
      setAlert("Error", `Failed to fetch jobs: ${fetchJobsError}`);
  }, [fetchJobsError, setAlert]);

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
      setSelectedPipeline(pipelines[0].uuid);
      setJobName("");
    } else {
      setAlert("Error", "Could not find any pipelines for this project.");
    }
  };

  const deleteSelectedJobs = async (jobUuids: string[]) => {
    // this is just a precaution. the button is disabled when isDeleting is true.
    if (isDeleting) {
      console.error("Delete UI in progress.");
      return false;
    }

    setIsDeleting(true);

    if (jobUuids.length == 0) {
      setAlert("Error", "You haven't selected any jobs.");
      setIsDeleting(false);

      return false;
    }

    return setConfirm(
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
          return true;
        } catch (e) {
          setAlert("Error", `Failed to delete selected jobs: ${e}`);
          setIsDeleting(false);
          return false;
        }
      },
      async () => {
        setIsDeleting(false);
        return false;
      }
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
      <Dialog
        fullWidth
        maxWidth="xs"
        open={isEditingJobName}
        onClose={onCloseEditJobNameModal}
      >
        <form
          id="edit-job-name"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSubmitEditJobNameModal();
          }}
        >
          <DialogTitle>Edit job name</DialogTitle>
          <DialogContent>
            <TextField
              margin="normal"
              fullWidth
              value={jobName}
              label="Job name"
              autoFocus
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
              type="submit"
              form="edit-job-name"
            >
              Save
            </Button>
          </DialogActions>
        </form>
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
              <DialogTitle>Create a new job</DialogTitle>
              <DialogContent>
                {isCreatingJob ? (
                  <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
                    <LinearProgress />
                    <Typography sx={{ margin: (theme) => theme.spacing(1, 0) }}>
                      Copying pipeline directory...
                    </Typography>
                  </Box>
                ) : (
                  <Stack direction="column" spacing={2}>
                    {projectSnapshotSize > 50 && (
                      <Alert severity="warning">
                        {`Snapshot size exceeds 50MB. Please refer to the `}
                        <Link href="https://docs.orchest.io/en/stable/fundamentals/jobs.html">
                          docs
                        </Link>
                        .
                      </Alert>
                    )}
                    <FormControl fullWidth>
                      <TextField
                        margin="normal"
                        value={jobName}
                        autoFocus
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
                        onChange={(e) => setSelectedPipeline(e.target.value)}
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
                  </Stack>
                )}
              </DialogContent>
              <DialogActions>
                <Button color="secondary" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  disabled={!jobName || isCreatingJob}
                  type="submit"
                  form="create-job"
                  data-test-id="job-create-ok"
                >
                  Create
                </Button>
              </DialogActions>
            </form>
          </Dialog>
          <DataTable<DisplayedJob>
            id="job-list"
            isLoading={isValidating}
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
