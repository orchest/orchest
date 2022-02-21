import { JobDocLink } from "@/job-view/JobDocLink";
import { PipelineMetaData } from "@/types";
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
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React from "react";

export const CreateJobDialog = ({
  isOpen,
  onClose,
  onSubmit,
  pipelines,
  selectedPipeline,
  setSelectedPipeline,
  projectSnapshotSize = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (jobName: string, pipelineUuid: string) => Promise<void>;
  pipelines?: PipelineMetaData[];
  selectedPipeline?: string;
  setSelectedPipeline: (uuid: string) => void;
  projectSnapshotSize?: number;
}) => {
  const [isCreatingJob, setIsCreatingJob] = React.useState(false);
  const [jobName, setJobName] = React.useState("");

  const closeDialog = !isCreatingJob ? onClose : undefined;

  React.useEffect(() => {
    if (isOpen && pipelines && pipelines.length > 0) {
      setSelectedPipeline(pipelines[0].uuid);
    }
    return () => setSelectedPipeline("");
  }, [isOpen, pipelines, setSelectedPipeline]);

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
                      : " "
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
                  {(pipelines || []).map((pipeline) => {
                    return (
                      <MenuItem key={pipeline.uuid} value={pipeline.uuid}>
                        {pipeline.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              {projectSnapshotSize > 50 && (
                <Alert severity="warning">
                  {`Snapshot size exceeds 50MB. You might want to enable Auto Clean-up to free up disk space regularly. Check the `}
                  <JobDocLink />
                  {` for more details.`}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="secondary" tabIndex={-1} onClick={closeDialog}>
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
