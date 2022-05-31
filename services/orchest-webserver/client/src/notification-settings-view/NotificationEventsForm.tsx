import { DataTable, DataTableColumn } from "@/components/DataTable";
import React from "react";
import { NotificationEventType } from "./notification-webhooks";
import { useNotificationSettingsContext } from "./NotificationSettingsContext";

type NotificationEventTypeRow = { uuid: string } & Pick<
  NotificationEventType,
  "name"
>;

export const NotificationEventsForm = () => {
  const { notificationEventTypes } = useNotificationSettingsContext();

  const columns: DataTableColumn<NotificationEventTypeRow>[] = [
    { id: "name", label: " " },
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
