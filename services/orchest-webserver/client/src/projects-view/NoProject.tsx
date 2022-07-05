import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const NoProject = () => {
  const containerRef = React.useRef<HTMLSpanElement | null>(null);
  const mainBodyRef = React.useRef<HTMLSpanElement | null>(null);

  return (
    <Stack
      ref={containerRef}
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(4) }}
    >
      <Typography variant="h5">No Projects</Typography>
      <Typography
        ref={mainBodyRef}
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
      <Link
        underline="hover"
        sx={{
          cursor: "pointer",
          textTransform: "uppercase",
          fontSize: (theme) => theme.typography.button.fontSize,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          marginTop: (theme) => theme.spacing(4),
        }}
        target="_blank"
        rel="noopener noreferrer"
        href="https://docs.orchest.io/en/stable/fundamentals/projects.html"
      >
        View docs
        <LaunchOutlinedIcon
          fontSize="small"
          sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
        />
      </Link>
    </Stack>
  );
};
