import { IconButton } from "@/components/common/IconButton";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { useAppContext } from "@/contexts/AppContext";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { AsyncStatus } from "@/hooks/useAsync";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WebhookIcon from "@mui/icons-material/Webhook";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateWebhookDialog } from "./create-webhook-dialog/CreateWebhookDialog";
import {
  deleteSubscriber,
  NotificationWebhookSubscriber,
} from "./notification-webhooks";
import { WebhookDocLink } from "./WebhookDocLink";
import { WebhookVerifiedCheck } from "./WebhookVerifiedCheck";

type WebhookRow = Pick<
  NotificationWebhookSubscriber,
  "uuid" | "url" | "name" | "verify_ssl"
>;

type WebhookColumn = WebhookRow & {
  verified: React.ReactNode;
  delete: React.ReactNode;
};

export const WebhookList = () => {
  const { setConfirm } = useGlobalContext();
  const { webhooks, setWebhooks } = useAppContext();

  const [isOpen, setIsOpen] = React.useState(false);
  const onClose = React.useCallback(() => setIsOpen(false), []);

  const webhooksVerifiedStatusRef = React.useRef<Record<string, AsyncStatus>>(
    {}
  );

  React.useEffect(() => {
    webhooks.forEach((hook) => {
      if (webhooksVerifiedStatusRef.current[hook.uuid] !== "RESOLVED") {
        webhooksVerifiedStatusRef.current[hook.uuid] = "IDLE";
      }
    });
  }, [webhooks]);

  const columns: DataTableColumn<WebhookRow, WebhookColumn>[] = [
    { id: "name", label: "Name", render: (row) => row.name || "-" },
    {
      id: "url",
      label: "URL",
      align: "left",
      render: function renderUrl(row) {
        return (
          <Stack direction="row" alignItems="center">
            {row.url}
            {row.verify_ssl && (
              <Chip
                label="SSL"
                size="small"
                sx={{ marginLeft: (theme) => theme.spacing(1) }}
              />
            )}
          </Stack>
        );
      },
    },
    {
      id: "verified",
      label: "Connection",
      align: "left",
      render: function renderVerified(row) {
        return (
          <WebhookVerifiedCheck
            subscriberUuid={row.uuid}
            webhooksVerifiedStatusRef={webhooksVerifiedStatusRef}
          />
        );
      },
    },
    {
      id: "delete",
      label: " ",
      render: function renderDelete(row) {
        return (
          <IconButton
            title="Delete"
            onClick={() => {
              setConfirm(
                "Notice",
                "Are you certain that you want to delete this webhook?",
                async (resolve) => {
                  deleteSubscriber(row.uuid).then(() => {
                    setWebhooks((current) =>
                      (current || []).filter((hook) => hook.uuid !== row.uuid)
                    );
                    resolve(true);
                  });
                  return true;
                }
              );
            }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        );
      },
    },
  ];

  const webhookRows: DataTableRow<WebhookRow>[] = webhooks.map(
    ({ uuid, name, url, verify_ssl }) => ({
      id: uuid,
      uuid,
      name,
      url,
      verify_ssl,
    })
  );

  return (
    <Stack
      direction="column"
      spacing={1}
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
        <Stack
          direction="row"
          sx={{ marginBottom: (theme) => theme.spacing(1) }}
        >
          <Typography
            variant="body2"
            sx={{ color: (theme) => theme.palette.text.secondary }}
          >
            {`Webhooks let you receive HTTP push notifications to a URL.`}
          </Typography>
          <WebhookDocLink>Webhook docs</WebhookDocLink>
        </Stack>
        {webhookRows.length > 0 && (
          <DataTable<WebhookRow, WebhookColumn>
            id="webhook-list"
            hideSearch
            disablePagination
            tableContainerElevation={0}
            columns={columns}
            rows={webhookRows}
          />
        )}
        <Box>
          <Button
            startIcon={<AddOutlinedIcon />}
            sx={{
              padding: (theme) => theme.spacing(1, 2),
              marginBottom: (theme) => theme.spacing(2),
            }}
            onClick={() => setIsOpen(true)}
          >
            New webhook
          </Button>
          {isOpen && <CreateWebhookDialog isOpen={isOpen} onClose={onClose} />}
        </Box>
      </Stack>
    </Stack>
  );
};
