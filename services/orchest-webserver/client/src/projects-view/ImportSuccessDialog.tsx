import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import React from "react";

type ImportSuccessDialogProps = {
  open: boolean;
  projectName: string;
  viewPipeline: (e: React.MouseEvent) => void;
  onClose: (e: React.MouseEvent) => void;
};

const ImportSuccessDialog = ({
  open,
  projectName,
  viewPipeline,
  onClose,
}: ImportSuccessDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Import complete</DialogTitle>
      <DialogContent>
        <div className="project-import-modal">
          <p className="push-down">
            You have imported <span className="bold">{projectName}</span>{" "}
            successfully! It is now visible in your project list.
          </p>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Continue browsing</Button>
        <Button
          variant="contained"
          autoFocus
          onClick={viewPipeline}
          onAuxClick={viewPipeline}
        >
          View pipeline
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { ImportSuccessDialog };
