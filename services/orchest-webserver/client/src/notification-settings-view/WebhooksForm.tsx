import { IconButton } from "@/components/common/IconButton";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WebhookIcon from "@mui/icons-material/Webhook";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { NotificationWebhookSubscriber } from "./notification-webhooks";
import { useFetchNotificationSubscribers } from "./useFetchNotificationSubscribers";
import { WebhookVerifiedCheck } from "./WebhookVerifiedCheck";

type WebhookRow = Pick<
  NotificationWebhookSubscriber,
  "uuid" | "url" | "name"
> & {
  verified: React.ReactNode;
  delete: React.ReactNode;
};

export const WebhooksForm = () => {
  const {
    subscribers: webhooks = [],
    setSubscribers: setWebhooks,
    status,
    fetchNotificationSubscribers: fetchWebhooks,
  } = useFetchNotificationSubscribers<NotificationWebhookSubscriber[]>(
    (subscribers) =>
      subscribers.filter(
        (subscriber): subscriber is NotificationWebhookSubscriber =>
          subscriber.type === "webhook"
      )
  );

  const columns: DataTableColumn<WebhookRow>[] = [
    { id: "name", label: "Name" },
    { id: "url", label: "URL", align: "left" },
    { id: "verified", label: "Verified", align: "center" },
    { id: "delete", label: " " },
  ];

  const webhookRows: WebhookRow[] = webhooks.map(({ uuid, name, url }) => ({
    uuid,
    name,
    url,
    verified: <WebhookVerifiedCheck subscriberUuid={uuid} />,
    delete: (
      <IconButton title="Delete">
        <DeleteOutlineIcon />
      </IconButton>
    ),
  }));

  return (
    <Stack
      direction="column"
      spacing={2}
      sx={{
        margin: (theme) => theme.spacing(2, 0),
        width: "100%",
      }}
    >
      <Stack direction="row" alignItems="center">
        <WebhookIcon
          fontSize="small"
          sx={{ margin: (theme) => theme.spacing(0, 2) }}
        />
        <Typography component="h6" variant="subtitle1">
          Webhooks
        </Typography>
      </Stack>

      <Stack
        direction="column"
        spacing={2}
        sx={{ paddingLeft: (theme) => theme.spacing(6.5) }}
      >
        <Stack direction="row" sx={{ margin: (theme) => theme.spacing(2, 0) }}>
          <Typography variant="body2">
            {`Webhooks let you receive HTTP push notifications to a URL after an
            event happens `}
          </Typography>
          <Link
            variant="body2"
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              margin: (theme) => theme.spacing(0, 1),
            }}
          >
            {`Webhook docs `}
            <OpenInNewIcon
              sx={{
                fontSize: (theme) => theme.spacing(2),
                marginLeft: (theme) => theme.spacing(1),
              }}
            />
          </Link>
        </Stack>
        <DataTable<WebhookRow>
          id="webhook-list"
          hideSearch
          columns={columns}
          rows={webhookRows}
        />
        <Box>
          <Button
            sx={{
              padding: (theme) => theme.spacing(1, 2),
              marginBottom: (theme) => theme.spacing(2),
            }}
          >
            Add webhook
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};
