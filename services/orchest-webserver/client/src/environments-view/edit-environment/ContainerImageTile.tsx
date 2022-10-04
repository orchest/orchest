import Paper from "@mui/material/Paper";
import { alpha, SxProps, Theme } from "@mui/material/styles";
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
        minHeight: (theme) => theme.spacing(6),
        width: "100%",
        borderRadius: (theme) => theme.spacing(1),
        backgroundColor: (theme) =>
          checked
            ? alpha(theme.palette.primary.light, 0.2)
            : theme.palette.common.white,
        border: (theme) =>
          `${checked ? 2 : 1}px solid ${
            checked ? theme.palette.primary.main : theme.borderColor
          }`,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};
