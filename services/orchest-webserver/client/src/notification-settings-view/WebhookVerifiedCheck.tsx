import { AsyncStatus } from "@/hooks/useAsync";
import { ExtractStringLiteralType } from "@/types";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import React from "react";
import { useVerifyWebhook } from "./useVerifyWebhook";

type StatusMessageKey = ExtractStringLiteralType<
  AsyncStatus,
  "PENDING" | "RESOLVED" | "REJECTED"
>;

export const webhookStatusMessage: Record<
  StatusMessageKey,
  { message: string; component: React.ReactElement }
> = {
  PENDING: {
    message: "Checking...",
    component: (
      <CircularProgress
        size={24}
        sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
      />
    ),
  },
  RESOLVED: {
    message: "Connected",
    component: (
      <CheckCircleOutlineIcon
        color="success"
        sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
      />
    ),
  },
  REJECTED: {
    message: "Failed",
    component: (
      <ErrorOutlineIcon
        color="error"
        sx={{ marginLeft: (theme) => theme.spacing(0.5) }}
      />
    ),
  },
};

export const WebhookVerifiedCheck = ({
  subscriberUuid,
  webhooksVerifiedStatusRef,
}: {
  subscriberUuid: string;
  webhooksVerifiedStatusRef: React.MutableRefObject<
    Record<string, AsyncStatus>
  >;
}) => {
  const { status, verify } = useVerifyWebhook(subscriberUuid);

  React.useEffect(() => {
    // if user clicks on "TEST" button, update the persisted status.
    if (status !== "IDLE")
      webhooksVerifiedStatusRef.current[subscriberUuid] = status;
  }, [subscriberUuid, status, webhooksVerifiedStatusRef]);

  const latestStatus =
    status === "IDLE"
      ? webhooksVerifiedStatusRef.current[subscriberUuid]
      : status;

  const { message, component = null } =
    webhookStatusMessage[latestStatus] || {};

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Button onClick={verify}>Test</Button>
      <Box
        sx={{
          width: (theme) => theme.spacing(3),
          height: (theme) => theme.spacing(3),
        }}
      >
        {component && <Tooltip title={message}>{component}</Tooltip>}
      </Box>
    </Stack>
  );
};
