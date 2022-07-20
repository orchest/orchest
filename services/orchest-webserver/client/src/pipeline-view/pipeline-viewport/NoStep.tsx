import { ViewDocsLink } from "@/components/common/ViewDocsLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const NoStep = () => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(4) }}
    >
      <Box
        component="img"
        src="/image/no-step.svg"
        sx={{
          width: "24%",
          maxWidth: (theme) => theme.spacing(40),
          margin: (theme) => theme.spacing(2, 0, 0, 0),
        }}
      />
      <Typography variant="h5">No Pipeline Steps</Typography>
      <Typography
        variant="body1"
        align="center"
        sx={{
          width: (theme) => theme.spacing(44),
          marginTop: (theme) => theme.spacing(1),
        }}
      >
        A Pipeline Step is an executable file running in its own isolated
        environment. Drag & drop files from the side panel to get started.
      </Typography>
      <ViewDocsLink sx={{ marginTop: (theme) => theme.spacing(4) }} />
    </Stack>
  );
};
