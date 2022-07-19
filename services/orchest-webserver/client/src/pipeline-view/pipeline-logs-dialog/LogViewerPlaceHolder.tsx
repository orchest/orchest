import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const LogViewerPlaceHolder = () => (
  <Stack
    alignItems="center"
    justifyContent="center"
    sx={{
      backgroundColor: (theme) => theme.palette.common.black,
      width: "100%",
      height: "100%",
      color: (theme) => theme.palette.grey[800],
    }}
  >
    <Typography variant="h3" component="span">
      No logs available
    </Typography>
  </Stack>
);
