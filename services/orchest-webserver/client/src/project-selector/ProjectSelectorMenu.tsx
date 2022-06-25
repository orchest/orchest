import Menu, { MenuProps } from "@mui/material/Menu";
import React from "react";

export const ProjectSelectorMenu: React.FC<{
  open: boolean;
  onClose: MenuProps["onClose"];
}> = ({ children, open, onClose }) => {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      marginThreshold={0}
      anchorPosition={{ top: 56, left: 0 }}
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
