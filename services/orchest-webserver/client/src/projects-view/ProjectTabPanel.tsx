import Box, { BoxProps } from "@mui/material/Box";
import React from "react";

export const ProjectTabPanel: React.FC<
  {
    id: string;
    index: number;
    value: number;
  } & BoxProps
> = ({ value, index, id, children, sx, ...props }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`${id}-tabpanel-${index}`}
      aria-labelledby={`${id}-tab-${index}`}
      sx={{ width: "100%", padding: (theme) => theme.spacing(1, 0), ...sx }}
      {...props}
    >
      {value === index && children}
    </Box>
  );
};
