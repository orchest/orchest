import { STATUS } from "@/hooks/useAsync";
import { useFetcher } from "@/hooks/useFetcher";
import { ExtractStringLiteralType } from "@/types";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import React from "react";
import { NOTIFICATION_END_POINT } from "./common";

type StatusMessageKey = ExtractStringLiteralType<
  STATUS,
  "PENDING" | "RESOLVED" | "REJECTED"
>;

const statusMessage: Record<
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
  const url = `${NOTIFICATION_END_POINT}/subscribers/test-ping-delivery/${subscriberUuid}`;

  const { status } = useFetcher(url);
  const { message, component = null } = statusMessage[status] || {};
  console.log("DEV message: ", message);
  return (
    <Tooltip title={message} open={!message ? false : undefined}>
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
