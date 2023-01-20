import { useNavigate } from "@/hooks/useCustomRoute";
import Button from "@mui/material/Button";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import React from "react";
import { ProjectIdentifiers } from "./ImportProjectDialog";

export type ImportSuccessDialogProps = Omit<DialogProps, "children"> & {
  project: ProjectIdentifiers;
};

export const ImportSuccessDialog = ({
  project,
  ...dialogProps
}: ImportSuccessDialogProps) => {
  const navigate = useNavigate();
  const viewPipeline = () =>
    navigate({
      route: "pipeline",
      query: { projectUuid: project.uuid },
      sticky: false,
    });

  return (
    <Dialog {...dialogProps}>
      <DialogTitle>Import complete</DialogTitle>
      <DialogContent>
        <div className="project-import-modal">
          <p className="push-down">
            You have imported <span className="bold">{project.path}</span>{" "}
            successfully! It is now visible in your project list.
          </p>
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => dialogProps.onClose?.({}, "backdropClick")}
          data-test-id="import-success-dialog-close-button"
        >
          Close
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={viewPipeline}
          data-test-id="import-success-dialog-view-pipeline-button"
        >
          View pipeline
        </Button>
      </DialogActions>
    </Dialog>
  );
};
