import MuiIconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const IconButton: React.FC<IconButtonProps> = ({ title, ...props }) => {
  return title ? (
    <Tooltip title={title}>
      <MuiIconButton {...props} />
    </Tooltip>
  ) : (
    <MuiIconButton {...props} />
  );
};
