import Box from "@mui/material/Box";
import MuiIconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ title, disabled, ...props }, ref) {
    return title ? (
      <Tooltip title={title}>
        {disabled ? (
          <Box>
            <MuiIconButton {...props} disabled={disabled} ref={ref} />
          </Box>
        ) : (
          <MuiIconButton {...props} ref={ref} />
        )}
      </Tooltip>
    ) : (
      <MuiIconButton {...props} disabled={disabled} />
    );
  }
);
