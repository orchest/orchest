import MuiIconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const IconButton: React.FC<IconButtonProps> = (props) => {
  const { title, ...rest } = props;
  return title ? (
    <Tooltip title={title}>
      <MuiIconButton {...rest} />
    </Tooltip>
  ) : (
    <MuiIconButton {...rest} />
  );
};
