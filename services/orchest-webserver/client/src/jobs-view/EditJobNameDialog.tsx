import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import React from "react";

export const EditJobNameDialog = ({
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
                : " "
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
