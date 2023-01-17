import { useToggle } from "@/hooks/useToggle";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";
import { NewProjectDialog } from "./NewProjectDialog";

export const NewProjectButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function NewProjectButton({ children = "New Project", ...buttonProps }, ref) {
  const [isDialogOpen, toggleDialog] = useToggle();

  return (
    <>
      <Button
        ref={ref}
        variant="contained"
        startIcon={<AddOutlined />}
        onClick={() => toggleDialog(true)}
        data-test-id="new-project-button"
        {...buttonProps}
      >
        {children}
      </Button>

      <NewProjectDialog
        open={isDialogOpen}
        onClose={() => toggleDialog(false)}
        onSubmit={() => toggleDialog(false)}
      />
    </>
  );
});
