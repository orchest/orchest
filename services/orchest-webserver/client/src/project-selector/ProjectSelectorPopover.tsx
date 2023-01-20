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
      anchorPosition={{ top: 0, left: 0 }}
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          maxHeight: "100vh",
          minHeight: "100vh",
          overflow: "hidden",
          width: (theme) => theme.spacing(40),
          borderRadius: 0,
          position: "absolute",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {children}
    </Popover>
  );
};
