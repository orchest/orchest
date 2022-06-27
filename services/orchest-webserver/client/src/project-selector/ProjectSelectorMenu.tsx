import Fade from "@mui/material/Fade";
import Menu, { MenuProps } from "@mui/material/Menu";
import React from "react";

export const ProjectSelectorMenu = ({
  children,
  open,
  onClose,
  ...props
}: MenuProps) => {
  return (
    <Menu
      {...props}
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      marginThreshold={0}
      anchorPosition={{ top: 56, left: 0 }}
      TransitionComponent={Fade}
      PaperProps={{
        style: {
          minHeight: "calc(100vh - 56px)",
          maxHeight: "calc(100vh - 56px)",
          width: "320px",
          borderRadius: 0,
        },
      }}
    >
      {children}
    </Menu>
  );
};
