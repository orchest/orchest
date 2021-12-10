import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

export type TStatus =
  | "DRAFT"
  | "PENDING"
  | "STARTED"
  | "PAUSED"
  | "SUCCESS"
  | "ABORTED"
  | "FAILURE"
  | (Record<string, unknown> & string);

const StatusText = styled(Box)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

export const StatusInline: React.FC<{
  status: TStatus;
}> = ({ status }) => {
  return (
    <Stack component="span" direction="row" alignItems="center">
      {
        {
          ABORTED: (
            <>
              <CloseOutlinedIcon sx={{ color: "error.light" }} />
              <StatusText>Cancelled</StatusText>
            </>
          ),
          DRAFT: (
            <>
              <NoteAltOutlinedIcon
                sx={{ color: (theme) => theme.palette.grey[500] }}
              />
              <StatusText>Draft</StatusText>
            </>
          ),
          STARTED: (
            <>
              <AccessTimeIcon sx={{ color: "warning.light" }} />
              <StatusText>Running…</StatusText>
            </>
          ),
          PAUSED: (
            <>
              <AccessTimeIcon
                sx={{ color: (theme) => theme.palette.grey[500] }}
              />
              <StatusText>Paused</StatusText>
            </>
          ),
          PENDING: (
            <>
              <AccessTimeIcon sx={{ color: "warning.light" }} />
              <StatusText>Pending…</StatusText>
            </>
          ),
          FAILURE: (
            <>
              <CloseOutlinedIcon sx={{ color: "error.light" }} />
              <StatusText>Failed</StatusText>
            </>
          ),
          SUCCESS: (
            <>
              <CheckIcon sx={{ color: "success.light" }} />
              <StatusText>Success</StatusText>
            </>
          ),
        }[status]
      }
    </Stack>
  );
};

export type IStatusGroupProps = {
  status: TStatus;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  ["data-test-id"]: string;
};

export const StatusGroup: React.FC<IStatusGroupProps> = ({
  title,
  description,
  icon,
  status,
  ["data-test-id"]: testId,
}) => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: (theme) => `${theme.spacing(6)} minmax(0, 1fr)`,
      alignItems: "start",
      columnGap: (theme) => theme.spacing(2),
    }}
    data-test-id={testId}
  >
    <Box component="dt" sx={{ justifySelf: "center" }}>
      {icon ||
        {
          ABORTED: <CloseOutlinedIcon sx={{ color: "error" }} />,
          DRAFT: (
            <NoteAltOutlinedIcon
              sx={{ color: (theme) => theme.palette.grey[500] }}
            />
          ),
          STARTED: <AccessTimeIcon sx={{ color: "warning" }} />,
          PAUSED: (
            <AccessTimeIcon
              sx={{ color: (theme) => theme.palette.grey[500] }}
            />
          ),
          PENDING: <AccessTimeIcon sx={{ color: "warning" }} />,
          FAILURE: <CancelOutlinedIcon sx={{ color: "error" }} />,
          SUCCESS: <CheckCircleOutlineIcon sx={{ color: "$success" }} />,
        }[status]}
    </Box>
    <Typography component="dt" variant="h6">
      {title}
    </Typography>
    {description && (
      <Typography sx={{ color: "secondary" }} component="dd">
        {description}
      </Typography>
    )}
  </Box>
);
