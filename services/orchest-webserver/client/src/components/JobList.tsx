import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { EnvironmentValidationData, Job, JobStatus, Project } from "@/types";
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
import { fetcher, HEADER } from "@orchest/lib-utils";
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

const CreateJobDialog = ({
  isOpen,
  onClose,
  onSubmit,
  pipelines = [],
  selectedPipeline,
  setSelectedPipeline,
  projectSnapshotSize = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (jobName: string, pipelineUuid: string) => Promise<void>;
  pipelines: Pipeline[];
  selectedPipeline?: string;
  setSelectedPipeline: (uuid: string) => void;
  projectSnapshotSize?: number;
}) => {
  const [isCreatingJob, setIsCreatingJob] = React.useState(false);
  const [jobName, setJobName] = React.useState("");

  const closeDialog = !isCreatingJob ? onClose : undefined;

  React.useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      setSelectedPipeline(pipelines[0].uuid);
    }
    return () => setSelectedPipeline(undefined);
  }, [pipelines, setSelectedPipeline]);

  const hasOnlySpaces = jobName.length > 0 && jobName.trim().length === 0;

  return (
    <Dialog open={isOpen} onClose={closeDialog} fullWidth maxWidth="xs">
      <form
        id="create-job"
        className="create-job-modal"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsCreatingJob(true);
          await onSubmit(jobName.trim(), selectedPipeline);
          setIsCreatingJob(false);
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
                  required
                  margin="normal"
                  value={jobName}
                  autoFocus
                  error={hasOnlySpaces}
                  helperText={
                    hasOnlySpaces
                      ? "Should contain at least one non-whitespace letter"
                      : ""
                  }
                  onChange={(e) => setJobName(e.target.value)}
                  label="Job name"
                  data-test-id="job-create-name"
                />
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="select-pipeline-label">Pipeline</InputLabel>
                <Select
                  required
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
          <Button color="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              !jobName || hasOnlySpaces || !selectedPipeline || isCreatingJob
            }
            type="submit"
            form="create-job"
            data-test-id="job-create-ok"
          >
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const EditJobNameDialog = ({
  isOpen,
  onClose,
  onSubmit,
  currentValue,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
  currentValue: string;
}) => {
  const [isSubmittingJobName, setIsSubmittingJobName] = React.useState(false);
  const [jobName, setJobName] = React.useState("");

  React.useEffect(() => {
    if (isOpen && currentValue) setJobName(currentValue);
  }, [isOpen, currentValue]);

  const closeDialog = !isSubmittingJobName ? onClose : undefined;
  const hasOnlySpaces = jobName.length > 0 && jobName.trim().length === 0;

  return (
    <Dialog fullWidth maxWidth="xs" open={isOpen} onClose={closeDialog}>
      <form
        id="edit-job-name"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();

          setIsSubmittingJobName(true);
          await onSubmit(jobName);
          setIsSubmittingJobName(false);
          onClose();
        }}
      >
        <DialogTitle>Edit job name</DialogTitle>
        <DialogContent>
          <TextField
            required
            margin="normal"
            fullWidth
            error={hasOnlySpaces}
            helperText={
              hasOnlySpaces
                ? "Should contain at least one non-whitespace letter"
                : ""
            }
            value={jobName}
            label="Job name"
            autoFocus
            onChange={(e) => setJobName(e.target.value)}
            data-test-id="job-edit-name-textfield"
          />
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            startIcon={<SaveIcon />}
            disabled={isSubmittingJobName || jobName.length === 0}
            variant="contained"
            type="submit"
            form="edit-job-name"
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
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
            <EditIcon fontSize="small" />
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
      return <StatusInline status={row.status} size="small" />;
    },
  },
];

const doCreateJob = async (
  projectUuid: string,
  newJobName: string,
  pipelineUuid: string,
  pipelineName: string
) => {
  await checkGate(projectUuid);
  return fetcher<Job>("/catch/api-proxy/api/jobs/", {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
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
    }),
  });
};

type Pipeline = {
  uuid: string;
  path: string;
  name: string;
};

const JobList: React.FC<{ projectUuid: string }> = ({ projectUuid }) => {
  const { navigateTo } = useCustomRoute();
  const { setAlert, setConfirm, requestBuild } = useAppContext();

  const {
    data: jobs = [],
    error: fetchJobsError,
    isValidating: isFetchingJobs,
    revalidate: fetchJobs,
    mutate: setJobs,
  } = useSWR(
    projectUuid
      ? `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      : null,
    (url: string) =>
      fetcher<{ jobs: Job[] }>(url).then((response) => response.jobs)
  );

  const { data: pipelines = [] } = useSWR(
    projectUuid ? `/async/pipelines/${projectUuid}` : null,
    (url: string) =>
      fetcher<{
        success: boolean;
        result: Pipeline[];
      }>(url)
        .then((response) => response.result)
        .catch((e) => {
          if (e && e.status == 404) {
            navigateTo(siteMap.projects.path);
          }
        })
  );

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const { data: projectSnapshotSize = 0 } = useSWR(
    projectUuid && isCreateDialogOpen ? `/async/projects/${projectUuid}` : null,
    (url: string) =>
      fetcher<Project>(url)
        .then((response) => response.project_snapshot_size)
        .catch((e) => console.error(e))
  );

  const [isEditingJobName, setIsEditingJobName] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");
  const [selectedPipeline, setSelectedPipeline] = React.useState<
    string | undefined
  >();

  React.useEffect(() => {
    if (fetchJobsError)
      setAlert("Error", `Failed to fetch jobs: ${fetchJobsError}`);
  }, [fetchJobsError, setAlert]);

  const onCreateClick = () => {
    if (pipelines !== undefined && pipelines.length > 0) {
      setIsCreateDialogOpen(true);
    } else {
      setAlert("Error", "Could not find any pipelines for this project.");
    }
  };

  const deleteSelectedJobs = async (jobUuids: string[]) => {
    return setConfirm(
      "Warning",
      "Are you sure you want to delete these jobs? (This cannot be undone.)",
      async (resolve) => {
        try {
          Promise.all(
            jobUuids.map((uuid) => {
              return fetcher(`/catch/api-proxy/api/jobs/cleanup/${uuid}`, {
                method: "DELETE",
              });
            })
          )
            .then(() => {
              fetchJobs();
              resolve(true);
            })
            .catch((e) => {
              setAlert("Error", `Failed to delete selected jobs: ${e}`);
              resolve(false);
            });
          return true;
        } catch (e) {
          return false;
        }
      }
    );
  };

  const { run, error: createJobError } = useAsync<
    void,
    { reason: string; data: EnvironmentValidationData; message: string }
  >();

  const createJob = React.useCallback(
    async (newJobName: string, pipelineUuid: string) => {
      setJobName(newJobName);
      // TODO: in this part of the flow copy the pipeline directory to make
      // sure the pipeline no longer changes

      const pipelineName = pipelines.find(
        (pipeline) => pipeline.uuid === pipelineUuid
      )?.name;

      return run(
        doCreateJob(projectUuid, newJobName, pipelineUuid, pipelineName).then(
          (job) => {
            navigateTo(siteMap.editJob.path, {
              query: {
                projectUuid,
                jobUuid: job.uuid,
              },
            });
          }
        )
      );
    },
    [pipelines, run, navigateTo, projectUuid]
  );

  React.useEffect(() => {
    if (createJobError) {
      setIsCreateDialogOpen(false);

      if (createJobError.reason === "gate-failed") {
        requestBuild(projectUuid, createJobError.data, "CreateJob", () => {
          setIsCreateDialogOpen(true);
          createJob(jobName, selectedPipeline);
        });
        return;
      }

      setAlert("Error", `Failed to create job. ${createJobError.message}`);
    }
  }, [createJobError, setAlert, requestBuild, createJob]);

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
      setJobName(newJobName);
      setJobUuid(newJobUuid);
      setIsEditingJobName(true);
    };
    return createColumns({ onEditJobNameClick });
  }, []);

  const onCloseEditJobNameModal = () => {
    setIsEditingJobName(false);
    setJobName("");
  };

  const onSubmitEditJobNameModal = async (newJobName: string) => {
    try {
      await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}`, {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify({ name: newJobName.trim() }),
      });
      setJobs((currentJobs) => {
        const found = currentJobs.find(
          (currentJob) => currentJob.uuid === jobUuid
        );
        found.name = newJobName;
        return currentJobs;
      }, false);
    } catch (e) {
      setAlert("Error", `Failed to update job name: ${JSON.stringify(e)}`);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  return (
    <div className={"jobs-page"}>
      <h2>Jobs</h2>
      {jobs && pipelines ? (
        <>
          <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={onCreateClick}
              sx={{ marginBottom: (theme) => theme.spacing(2) }}
              data-test-id="job-create"
            >
              Create job
            </Button>
          </Box>
          <CreateJobDialog
            isOpen={isCreateDialogOpen}
            onClose={closeCreateDialog}
            onSubmit={createJob}
            pipelines={pipelines}
            selectedPipeline={selectedPipeline}
            setSelectedPipeline={setSelectedPipeline}
            projectSnapshotSize={projectSnapshotSize}
          />
          <EditJobNameDialog
            onSubmit={onSubmitEditJobNameModal}
            isOpen={isEditingJobName}
            onClose={onCloseEditJobNameModal}
            currentValue={jobName}
          />
          <DataTable<DisplayedJob>
            id="job-list"
            isLoading={isFetchingJobs}
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
            rowHeight={63}
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
