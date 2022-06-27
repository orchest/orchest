import Fade from "@mui/material/Fade";
import Popover, { PopoverProps } from "@mui/material/Popover";
import React from "react";

export const HEADER_BAR_HEIGHT = 56;

export const ProjectSelectorPopover = ({
  children,
  open,
  onClose,
  ...props
}: PopoverProps) => {
  return (
    <Popover
      {...props}
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      marginThreshold={0}
      anchorPosition={{ top: HEADER_BAR_HEIGHT, left: 0 }}
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          minHeight: (theme) => `calc(100vh - ${theme.spacing(7)})`,
          maxHeight: (theme) => `calc(100vh - ${theme.spacing(7)})`,
          overflow: "hidden",
          width: (theme) => theme.spacing(40),
          borderRadius: 0,
          position: "relative",
        },
      }}
    >
      {children}
    </Popover>
  );
};
