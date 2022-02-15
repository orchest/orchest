import { EnvironmentBuild } from "@/types";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import { SxProps, Theme } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

const statusIconMapping: Partial<Record<
  EnvironmentBuild["status"],
  { message: string; icon?: React.ReactNode }
>> = {
  STARTED: {
    message: "Building...",
    icon: (
      <HourglassTopOutlinedIcon
        sx={{ color: (theme) => theme.palette.grey[500] }}
      />
    ),
  },
  SUCCESS: {
    message: "Build successfully completed!",
    icon: <CheckCircleIcon color="primary" />,
  },
  FAILURE: {
    message: "Failed to build image",
    icon: <HighlightOffIcon sx={{ color: "error.light" }} />,
  },
  ABORTED: {
    message: "Build was cancelled",
    icon: <HighlightOffIcon sx={{ color: "error.light" }} />,
  },
  PENDING: {
    message: "Getting ready to build...",
    icon: (
      <HourglassEmptyOutlinedIcon
        sx={{ color: (theme) => theme.palette.grey[500] }}
      />
    ),
  },
};

export const ImageBuildStatus = ({
  build,
  sx,
}: {
  build: EnvironmentBuild | undefined;
  sx?: SxProps<Theme>;
}) => {
  const inProgress = ["PENDING", "STARTED"].includes(build?.status);
  return build ? (
    <Stack
      direction="column"
      spacing={1}
      sx={{ paddingBottom: (theme) => theme.spacing(0.5), ...sx }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {statusIconMapping[build.status].icon}
        <Typography
          variant="body2"
          color="InfoText"
          data-test-id="environments-build-status"
        >
          {statusIconMapping[build.status].message}
        </Typography>
      </Stack>
      <LinearProgress
        value={!inProgress ? 100 : undefined}
        variant={!inProgress ? "determinate" : "indeterminate"}
        sx={{
          minHeight: (theme) => theme.spacing(0.5),
          borderRadius: (theme) => theme.spacing(0.5),
        }}
      />
    </Stack>
  ) : null;
};
