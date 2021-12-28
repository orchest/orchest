import MuiIconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const IconButton: React.FC<IconButtonProps> = (props) => {
  return props.title ? (
    <Tooltip title={props.title}>
      <MuiIconButton {...props} />
    </Tooltip>
  ) : (
    <MuiIconButton {...props} />
  );
};
