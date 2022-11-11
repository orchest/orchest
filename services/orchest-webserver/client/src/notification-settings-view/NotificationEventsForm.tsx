import { DataTable, DataTableColumn } from "@/components/DataTable";
import { useAppContext } from "@/contexts/AppContext";
import { useGlobalContext } from "@/contexts/GlobalContext";
import Switch from "@mui/material/Switch";
import React from "react";
import { displayEventMappings, EventForDisplay } from "./common";
import {
  NotificationSubscription,
  updateWebhook,
} from "./notification-webhooks";
import { useNotificationSettingsContext } from "./NotificationSettingsContext";

type NotificationEventTypeRow = {
  id: EventForDisplay;
  name: EventForDisplay;
};

type NotificationEventTypeColumn = NotificationEventTypeRow & {
  toggle: React.ReactNode;
};

const eventExplanationMappings: Record<EventForDisplay, string> = {
  "display:job-run-fails": "A job run fails",
};

export const NotificationEventsForm = () => {
  const { setAlert } = useGlobalContext();
  const { webhooks } = useAppContext();
  const {
    notificationEventTypes,
    enabledEventTypes,
    setEnabledEventTypes,
  } = useNotificationSettingsContext();

  const webhookUuids = React.useMemo(() => {
    return webhooks.map((hook) => hook.uuid);
  }, [webhooks]);

  const updateSubscriptions = React.useCallback(
    async (eventTypes: NotificationSubscription["event_type"][]) => {
      try {
        Promise.all(
          webhookUuids.map((uuid) =>
            updateWebhook(uuid, {
              subscriptions: eventTypes.map((event_type) => ({
                event_type,
              })),
            })
          )
        );
      } catch (error) {
        setAlert(
          "Error",
          "Failed to update the configurations for the webhooks.",
          (resolve) => {
            resolve(true);
            window.location.reload();
            return true;
          }
        );
      }
    },
    [webhookUuids, setAlert]
  );

  const handleEvent = React.useCallback(
    (eventType: EventForDisplay, value: boolean) => {
      setEnabledEventTypes((current) => {
        const updatedEnabledEventTypes = value
          ? current
            ? [...new Set([...current, eventType])]
            : [eventType]
          : (current || []).filter(
              (existingEventType) => existingEventType !== eventType
            );

        updateSubscriptions(
          updatedEnabledEventTypes.flatMap(
            (eventsForDisplay) => displayEventMappings[eventsForDisplay] || []
          )
        );

        return updatedEnabledEventTypes;
      });
    },
    [setEnabledEventTypes, updateSubscriptions]
  );

  const columns: DataTableColumn<
    NotificationEventTypeRow,
    NotificationEventTypeColumn
  >[] = [
    {
      id: "name",
      label: "Notify me when...",
      render: function renderEventTypeName(row) {
        return eventExplanationMappings[row.name];
      },
    },
    {
      id: "toggle",
      label: " ",
      render: function renderEventTypeToggle(row) {
        const isEnabled = enabledEventTypes.includes(row.name);
        return (
          <Switch
            size="small"
            disabled={webhookUuids.length === 0}
            inputProps={{
              "aria-label": `Switch ${isEnabled ? "off" : "on"} event: ${
                eventExplanationMappings[row.name]
              }`,
            }}
            sx={{ margin: (theme) => theme.spacing(0, 1) }}
            checked={webhookUuids.length === 0 ? false : isEnabled}
            onChange={(_, checked) => handleEvent(row.name, checked)}
          />
        );
      },
    },
  ];

  const eventTypeRows = notificationEventTypes.map((name) => ({
    id: name,
    uuid: name,
    name,
  }));

  return (
    <DataTable<NotificationEventTypeRow, NotificationEventTypeColumn>
      id="webhook-list"
      hideSearch
      disablePagination
      tableContainerElevation={0}
      columns={columns}
      rows={eventTypeRows}
      sx={{ padding: (theme) => theme.spacing(2, 0, 2, 6), width: "100%" }}
    />
  );
};
