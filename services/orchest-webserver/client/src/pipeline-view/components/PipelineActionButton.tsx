import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";

export const PipelineActionButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function PipelineActionButtonComponent({ children, ...props }, ref) {
  return (
    <Button ref={ref} variant="contained" color="secondary" {...props}>
      {children}
    </Button>
  );
});
