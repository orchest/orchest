import { ViewDocsLink } from "@/components/common/ViewDocsLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const NoProject = () => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(4) }}
    >
      <Typography variant="h5">No Projects</Typography>
      <Typography
        variant="body1"
        align="center"
        sx={{
          width: (theme) => theme.spacing(44),
          marginTop: (theme) => theme.spacing(1),
        }}
      >
        Projects are the main container for organizing related Pipelines, Jobs,
        Environments and code.
      </Typography>
      <Box
        component="img"
        src="/image/no-project.svg"
        sx={{
          width: "24%",
          maxWidth: (theme) => theme.spacing(40),
          margin: (theme) => theme.spacing(2, 0, 0, 0),
        }}
      />
      <ViewDocsLink
        sx={{ marginTop: (theme) => theme.spacing(4) }}
        docPath="/fundamentals/projects.html"
      />
    </Stack>
  );
};
