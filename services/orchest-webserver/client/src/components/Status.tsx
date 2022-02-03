import { Job } from "@/types";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckIcon from "@mui/icons-material/Check";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import React from "react";

export type TStatus =
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE";

type IconSize = "small" | "inherit" | "large" | "medium";

// Keep this pattern and the one used in fuzzy DB search in sync, see
// fuzzy_filter_non_interactive_pipeline_runs.

export const statusMapping: Partial<Record<
  TStatus,
  { icon: (size?: IconSize) => React.ReactNode; text: string }
>> = {
  ABORTED: {
    icon: function AbortedIcon(size) {
      return (
        <CloseOutlinedIcon sx={{ color: "error.light" }} fontSize={size} />
      );
    },
    text: "Cancelled",
  },
  DRAFT: {
    icon: function DraftIcon(size) {
      return (
        <NoteAltOutlinedIcon
          sx={{ color: (theme) => theme.palette.grey[500] }}
          fontSize={size}
        />
      );
    },
    text: "Draft",
  },
  FAILURE: {
    icon: function FailureIcon(size) {
      return (
        <CloseOutlinedIcon sx={{ color: "error.light" }} fontSize={size} />
      );
    },
    text: "Failed",
  },
  PAUSED: {
    icon: function PausedIcon(size) {
      return (
        <AccessTimeIcon
          sx={{ color: (theme) => theme.palette.grey[500] }}
          fontSize={size}
        />
      );
    },
    text: "Paused",
  },
  PENDING: {
    icon: function PendingIcon(size) {
      return <AccessTimeIcon sx={{ color: "warning.light" }} fontSize={size} />;
    },
    text: "Pending…",
  },
  STARTED: {
    icon: function StartedIcon(size) {
      return <AccessTimeIcon sx={{ color: "warning.light" }} fontSize={size} />;
    },
    text: "Running…",
  },
  SUCCESS: {
    icon: function SuccessIcon(size) {
      return <CheckIcon sx={{ color: "success.light" }} fontSize={size} />;
    },
    text: "Success",
  },
};

export const StatusInline: React.FC<{
  status: TStatus;
  size?: IconSize;
}> = ({ status, size = "medium" }) => {
  return (
    <Tooltip title={statusMapping[status].text}>
      <Stack
        component="span"
        direction="row"
        alignItems="center"
        justifyContent="center"
      >
        {statusMapping[status].icon(size)}
        <Typography component="span" sx={visuallyHidden}>
          {statusMapping[status].text}
        </Typography>
      </Stack>
    </Tooltip>
  );
};

export type RenderedJobStatus =
  | Job["status"]
  | "FAILURE"
  | "MIXED_FAILURE"
  | "MIXED_PENDING";

export type IStatusGroupProps = {
  status: TStatus | RenderedJobStatus;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  ["data-test-id"]: string;
  style?: React.CSSProperties;
};

export const StatusGroup: React.FC<IStatusGroupProps> = ({
  title,
  description,
  icon,
  status,
  style,
  ["data-test-id"]: testId,
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
    }}
    component="dl"
    style={style}
    data-test-id={testId}
  >
    <Box
      component="dt"
      sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}
    >
      <Box
        component="span"
        sx={{
          width: (theme) => theme.spacing(3),
          height: (theme) => theme.spacing(3),
        }}
      >
        {icon}
      </Box>
      <Typography
        component="span"
        variant="h6"
        sx={{
          fontWeight: (theme) => theme.typography.fontWeightRegular,
          flex: 1,
          marginLeft: (theme) => theme.spacing(1),
        }}
      >
        {title || statusMapping[status].text}
      </Typography>
    </Box>
    {description && (
      <Typography
        component="dd"
        sx={{ color: "secondary", marginLeft: (theme) => theme.spacing(4) }}
        variant="body2"
      >
        {description}
      </Typography>
    )}
  </Box>
);
