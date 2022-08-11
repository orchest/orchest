import { PageTitle } from "@/components/common/PageTitle";
import { useAppContext } from "@/contexts/AppContext";
import { useAppInnerContext } from "@/contexts/AppInnerContext";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchJobs } from "@/hooks/useFetchJobs";
import { useFetchProjectSnapshotSize } from "@/hooks/useFetchProjectSnapshotSize";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { siteMap } from "@/routingConfig";
import { EnvironmentValidationData, JobStatus } from "@/types";
import { formatServerDateTime } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { IconButton } from "../components/common/IconButton";
import { DataTable, DataTableColumn } from "../components/DataTable";
import { StatusInline } from "../components/Status";
import { requestCreateJob } from "./common";
import { CreateJobDialog } from "./CreateJobDialog";
import { EditJobNameDialog } from "./EditJobNameDialog";
import { useFetchPipelinesOnCreateJob } from "./useFetchPipelinesOnCreateJob";

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
    sx: { margin: (theme) => theme.spacing(-0.5, 0) },
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

const JobList = () => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const { setAlert, setConfirm } = useAppContext();
  const { requestBuild } = useProjectsContext();
  const { webhooks } = useAppInnerContext();

  const goToNotificationSettings = () => {
    navigateTo(siteMap.notificationSettings.path);
  };

  const {
    jobs = [],
    error: fetchJobsError,
    isFetchingJobs,
    fetchJobs,
    setJobs,
  } = useFetchJobs(projectUuid);

  const { run, error: createJobError } = useAsync<
    void,
    { reason: string; data: EnvironmentValidationData; message: string }
  >();

  const [isEditingJobName, setIsEditingJobName] = React.useState(false);

  const [jobName, setJobName] = React.useState("");
  const [jobUuid, setJobUuid] = React.useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  const closeCreateDialog = React.useCallback(() => {
    setIsCreateDialogOpen(false);
    setJobName("");
  }, []);

  const pipelines = useFetchPipelinesOnCreateJob({
    isCreateDialogOpen,
    closeCreateDialog,
  });

  const [selectedPipeline, setSelectedPipeline] = React.useState<
    string | undefined
  >();

  const projectSnapshotSize = useFetchProjectSnapshotSize(projectUuid);

  React.useEffect(() => {
    if (fetchJobsError)
      setAlert("Error", `Failed to fetch jobs: ${fetchJobsError}`);
  }, [fetchJobsError, setAlert]);

  const onCreateClick = async () => {
    setIsCreateDialogOpen(true);
    setJobName("");
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
              resolve(true);
            })
            .catch((e) => {
              setAlert("Error", `Failed to delete selected jobs: ${e}`);
              resolve(false);
            })
            .finally(() => {
              fetchJobs();
            });
          return true;
        } catch (error) {
          return false;
        }
      }
    );
  };

  const createJob = React.useCallback(
    async (newJobName: string, pipelineUuid: string) => {
      if (!projectUuid) return;
      setJobName(newJobName);
      // TODO: in this part of the flow copy the pipeline directory to make
      // sure the pipeline no longer changes

      const pipelineName = (pipelines || []).find(
        (pipeline) => pipeline.uuid === pipelineUuid
      )?.name;

      return run(
        requestCreateJob(
          projectUuid,
          newJobName,
          pipelineUuid,
          pipelineName || ""
        ).then((job) => {
          navigateTo(siteMap.editJob.path, {
            query: {
              projectUuid,
              jobUuid: job.uuid,
            },
          });
        })
      );
    },
    [pipelines, run, navigateTo, projectUuid]
  );

  React.useEffect(() => {
    if (projectUuid && createJobError && selectedPipeline) {
      setIsCreateDialogOpen(false);

      if (createJobError.reason === "gate-failed") {
        requestBuild(
          projectUuid,
          createJobError.data,
          BUILD_IMAGE_SOLUTION_VIEW.JOBS
        ).then((hasBuilt) => {
          if (hasBuilt) {
            setIsCreateDialogOpen(true);
            createJob(jobName, selectedPipeline);
          }
        });
        return;
      }

      setAlert("Error", `Failed to create job. ${createJobError.message}`);
    }
  }, [
    createJobError,
    setAlert,
    requestBuild,
    createJob,
    projectUuid,
    jobName,
    selectedPipeline,
  ]);

  const onRowClick = (e: React.MouseEvent, uuid: string) => {
    const foundJob = jobs.find((job) => job.uuid === uuid);
    if (!foundJob) return;
    navigateTo(
      foundJob.status === "DRAFT" ? siteMap.editJob.path : siteMap.job.path,
      {
        query: {
          projectUuid,
          jobUuid: uuid,
        },
      },
      e
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
        if (!currentJobs) return currentJobs;
        return currentJobs.map((currentJob) => {
          return currentJob.uuid === jobUuid
            ? { ...currentJob, name: newJobName }
            : currentJob;
        });
      });
    } catch (e) {
      setAlert("Error", `Failed to update job name: ${JSON.stringify(e)}`);
    }
  };

  const [shouldHideWebhookHint, setShouldHideWebhookHint] = useLocalStorage(
    "hide_webhook_hint",
    false
  );

  const shouldShowWebhookHint =
    !shouldHideWebhookHint && webhooks.length === 0 && jobs.length > 0;

  return (
    <div className={"jobs-page"}>
      <PageTitle>Jobs</PageTitle>
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
      {jobs ? (
        <>
          <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={onCreateClick}
              sx={{ marginBottom: (theme) => theme.spacing(1) }}
              data-test-id="job-create"
            >
              Create job
            </Button>
          </Box>
          {shouldShowWebhookHint && (
            <Alert
              severity="info"
              action={
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ marginTop: (theme) => theme.spacing(-0.25) }}
                >
                  <Button
                    color="inherit"
                    size="small"
                    onClick={goToNotificationSettings}
                  >
                    New webhook
                  </Button>
                  <IconButton
                    onClick={() => setShouldHideWebhookHint(true)}
                    size="small"
                  >
                    <CloseIcon />
                  </IconButton>
                </Stack>
              }
            >
              Use webhooks to get notified when pipeline runs fail
            </Alert>
          )}
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
