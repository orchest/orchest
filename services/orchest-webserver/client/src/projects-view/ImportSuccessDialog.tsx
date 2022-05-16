import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import React from "react";

const ImportSuccessDialog: React.FC<{
  open: boolean;
  projectName: string;
  goToPipelines: (e: React.MouseEvent) => void;
  onClose: (e: React.MouseEvent) => void;
}> = ({ open, projectName, goToPipelines, onClose }) => {
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
        <Button color="secondary" onClick={onClose}>
          Continue browsing
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={goToPipelines}
          onAuxClick={goToPipelines}
        >
          View pipelines
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { ImportSuccessDialog };
