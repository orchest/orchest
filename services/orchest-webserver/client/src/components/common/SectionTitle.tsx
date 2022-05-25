import { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

export const SectionTitle: React.FC<{ sx?: SxProps<Theme> }> = ({
  children,
  sx,
}) => {
  return (
    <Typography component="h3" variant="h6" sx={sx}>
      {children}
    </Typography>
  );
};
