import { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

export const PageTitle: React.FC<{ sx?: SxProps<Theme> }> = ({
  children,
  sx,
}) => {
  return (
    <Typography
      component="h2"
      variant="h5"
      sx={{ marginBottom: (theme) => theme.spacing(3), ...sx }}
    >
      {children}
    </Typography>
  );
};
