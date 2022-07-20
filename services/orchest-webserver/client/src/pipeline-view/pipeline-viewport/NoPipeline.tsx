import { ViewDocsLink } from "@/components/common/ViewDocsLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const NoPipeline = () => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(4) }}
    >
      <Box
        component="img"
        src="/image/no-pipeline.svg"
        sx={{
          width: "24%",
          maxWidth: (theme) => theme.spacing(40),
          margin: (theme) => theme.spacing(2, 0, 0, 0),
        }}
      />
      <Typography variant="h5">No Pipelines in Project</Typography>
      <Typography
        variant="body1"
        align="center"
        sx={{
          width: (theme) => theme.spacing(44),
          marginTop: (theme) => theme.spacing(1),
        }}
      >
        Pipelines are an interactive tool for creating and experimenting with
        your data workflow. They are made up of steps and connections.
      </Typography>
      <ViewDocsLink sx={{ marginTop: (theme) => theme.spacing(4) }} />
    </Stack>
  );
};
