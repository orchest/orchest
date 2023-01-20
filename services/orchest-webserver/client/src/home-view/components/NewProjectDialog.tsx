import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import React from "react";
import { NewProjectForm } from "./NewProjectForm";

type NewProjectDialogProps = Omit<DialogProps, "children"> & {
  onCreated?: () => void;
};

export const NewProjectDialog = ({
  onCreated,
  onClose,
  open,
  ...dialogProps
}: NewProjectDialogProps) => {
  return (
    <Dialog
      fullWidth
      open={open}
      onClose={onClose}
      aria-label="new project dialog"
      data-test-id="new-project-dialog"
      maxWidth="xs"
      {...dialogProps}
    >
      <DialogTitle>New project</DialogTitle>
      <DialogContent>
        <NewProjectForm
          onCreated={onCreated}
          onCancel={() => onClose?.({}, "backdropClick")}
        />
      </DialogContent>
    </Dialog>
  );
};
