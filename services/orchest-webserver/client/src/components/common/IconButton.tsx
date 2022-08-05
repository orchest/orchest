import MuiIconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ title, ...props }, ref) {
    return title ? (
      <Tooltip title={title}>
        <MuiIconButton {...props} ref={ref} />
      </Tooltip>
    ) : (
      <MuiIconButton {...props} />
    );
  }
);
