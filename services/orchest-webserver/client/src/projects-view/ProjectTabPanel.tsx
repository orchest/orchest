import Box, { BoxProps } from "@mui/material/Box";
import React from "react";
import { useProjectTabsContext } from "./ProjectTabsContext";

export const ProjectTabPanel: React.FC<
  {
    id: string;
    index: number;
  } & BoxProps
> = ({ index, id, children, sx, ...props }) => {
  const { projectTabIndex } = useProjectTabsContext();
  return (
    <Box
      role="tabpanel"
      hidden={projectTabIndex !== index}
      id={`${id}-tabpanel-${index}`}
      aria-labelledby={`${id}-tab-${index}`}
      sx={{ width: "100%", padding: (theme) => theme.spacing(1, 0), ...sx }}
      {...props}
    >
      {projectTabIndex === index && children}
    </Box>
  );
};
