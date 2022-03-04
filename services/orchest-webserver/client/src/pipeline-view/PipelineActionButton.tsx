import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";

export const PipelineActionButton = ({ children, ...props }: ButtonProps) => {
  return (
    <Button variant="contained" color="secondary" {...props}>
      {children}
    </Button>
  );
};
