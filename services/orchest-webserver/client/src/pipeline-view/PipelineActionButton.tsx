import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";

export const PipelineActionButton = React.forwardRef(
  function PipelineActionButtonComponent(
    { children, ...props }: ButtonProps,
    ref: React.MutableRefObject<HTMLButtonElement>
  ) {
    return (
      <Button ref={ref} variant="contained" color="secondary" {...props}>
        {children}
      </Button>
    );
  }
);
