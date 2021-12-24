import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckIcon from "@mui/icons-material/Check";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

export type TStatus =
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE";

const statusMapping: Partial<Record<
  TStatus,
  { icon: React.ReactNode; text: string }
>> = {
  ABORTED: {
    icon: <CloseOutlinedIcon sx={{ color: "error.light" }} />,
    text: "Cancelled",
  },
  DRAFT: {
    icon: (
      <NoteAltOutlinedIcon sx={{ color: (theme) => theme.palette.grey[500] }} />
    ),
    text: "Draft",
  },
  FAILURE: {
    icon: <CloseOutlinedIcon sx={{ color: "error.light" }} />,
    text: "Failed",
  },
  PAUSED: {
    icon: <AccessTimeIcon sx={{ color: (theme) => theme.palette.grey[500] }} />,
    text: "Paused",
  },
  PENDING: {
    icon: <AccessTimeIcon sx={{ color: "warning.light" }} />,
    text: "Pending…",
  },
  STARTED: {
    icon: <AccessTimeIcon sx={{ color: "warning.light" }} />,
    text: "Running…",
  },
  SUCCESS: {
    icon: <CheckIcon sx={{ color: "success.light" }} />,
    text: "Success",
  },
};

export const StatusInline: React.FC<{
  status: TStatus;
}> = ({ status }) => {
  return (
    <Stack
      component="span"
      direction="row"
      alignItems="center"
      justifyContent="center"
    >
      <Tooltip title={statusMapping[status].text}>
        {statusMapping[status].icon}
      </Tooltip>
      {/* <StatusText>{statusMapping[status].text}</StatusText> */}
    </Stack>
  );
};

export type IStatusGroupProps = {
  status: TStatus;
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
        {icon || statusMapping[status].icon}
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
