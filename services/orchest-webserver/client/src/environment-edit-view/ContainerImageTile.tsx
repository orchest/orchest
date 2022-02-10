import Paper from "@mui/material/Paper";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";

export const ContainerImageTile: React.FC<{
  checked?: boolean;
}> = ({ children, checked = false }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100px",
        borderRadius: (theme) => theme.spacing(1),
        border: (theme) =>
          `1px solid ${
            checked ? theme.palette.primary.main : theme.borderColor
          }`,
      }}
    >
      {children}
    </Paper>
  );
};
