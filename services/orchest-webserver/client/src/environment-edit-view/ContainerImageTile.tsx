import { SxProps, Theme } from "@mui/material";
import Paper from "@mui/material/Paper";
import React from "react";

export const ContainerImageTile: React.FC<{
  checked?: boolean;
  sx?: SxProps<Theme>;
}> = ({ children, checked = false, sx }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100px",
        width: "100%",
        borderRadius: (theme) => theme.spacing(1),
        border: (theme) =>
          `2px solid ${
            checked ? theme.palette.primary.main : theme.borderColor
          }`,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};
