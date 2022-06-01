import { DataTable, DataTableColumn } from "@/components/DataTable";
import React from "react";
import { NotificationEventType } from "./notification-webhooks";
import { useNotificationSettingsContext } from "./NotificationSettingsContext";

type NotificationEventTypeRow = { uuid: string } & Pick<
  NotificationEventType,
  "name"
>;

const eventExplanationMappings = {
  "project:one-off-job:failed": "An one-off job failed",
  "project:one-off-job:pipeline-run:failed":
    "A pipeline run of a batch of one-off job runs failed",
  "project:cron-job:failed": "A cron job failed",
  "project:cron-job:run:failed": "A cron job run failed",
  "project:cron-job:run:pipeline-run:failed":
    "A pipeline run of a batch of cron job runs failed",
};

export const NotificationEventsForm = () => {
  const { notificationEventTypes } = useNotificationSettingsContext();

  const columns: DataTableColumn<NotificationEventTypeRow>[] = [
    {
      id: "name",
      label: " ",
      render: function renderEventTypeName(row) {
        return eventExplanationMappings[row.name];
      },
    },
  ];

  const eventTypeRows = notificationEventTypes.map(({ name }) => ({
    uuid: name,
    name,
  }));

  return (
    <DataTable<NotificationEventTypeRow>
      id="webhook-list"
      hideSearch
      disablePagination
      tableContainerElevation={0}
      columns={columns}
      rows={eventTypeRows}
    />
  );
};
