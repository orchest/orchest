import { STATUS } from "@/hooks/useAsync";
import { ExtractStringLiteralType } from "@/types";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import React from "react";
import { useVerifyWebhook } from "./useVerifyWebhook";

type StatusMessageKey = ExtractStringLiteralType<
  STATUS,
  "PENDING" | "RESOLVED" | "REJECTED"
>;

export const webhookStatusMessage: Record<
  StatusMessageKey,
  { message: string; component: React.ReactElement }
> = {
  PENDING: {
    message: "Checking...",
    component: <CircularProgress size={24} />,
  },
  RESOLVED: {
    message: "Connected",
    component: <CheckCircleOutlineIcon color="success" />,
  },
  REJECTED: {
    message: "Failed",
    component: <ErrorOutlineIcon color="error" />,
  },
};

export const WebhookVerifiedCheck = ({
  subscriberUuid,
}: {
  subscriberUuid: string;
}) => {
  const { status } = useVerifyWebhook(subscriberUuid);
  const { message, component = null } = webhookStatusMessage[status] || {};

  return (
    <Tooltip title={message}>
      <Box
        sx={{
          display: "inline-block",
          width: (theme) => theme.spacing(3),
          height: (theme) => theme.spacing(3),
        }}
      >
        {component}
      </Box>
    </Tooltip>
  );
};
