import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import { useNotificationSettingsContext } from "./NotificationSettingsContext";

export const NotificationEventsForm = () => {
  const { notificationEventTypes } = useNotificationSettingsContext();

  return (
    <Box>
      {notificationEventTypes.map((eventType) => {
        return (
          <Stack
            direction="row"
            alignItems="center"
            key={eventType.name}
            spacing={2}
            sx={{ width: "100%" }}
          >
            {eventType.name}
          </Stack>
        );
      })}
    </Box>
  );
};
