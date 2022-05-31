import { PageTitle } from "@/components/common/PageTitle";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Layout } from "@/components/Layout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { NotificationEventsForm } from "./NotificationEventsForm";
import { NotificationSettingsContextProvider } from "./NotificationSettingsContext";
import { WebhookList } from "./WebhookList";

const ReturnToJobsAlert = () => {
  const { navigateTo, prevPathname } = useCustomRoute();

  const returnToJobs = () => {
    navigateTo(siteMap.jobs.path);
  };

  return siteMap.jobs.path === prevPathname ? (
    <Alert
      severity="warning"
      action={
        <Button color="inherit" size="small" onClick={returnToJobs}>
          Return to Jobs
        </Button>
      }
      sx={{ marginBottom: (theme) => theme.spacing(2), width: "100%" }}
    >
      A valid Webhook URL is required for notifications to be enabled
    </Alert>
  ) : null;
};

export const NotificationSettingsView = () => {
  const { navigateTo } = useCustomRoute();

  const returnToSettings = () => {
    navigateTo(siteMap.settings.path);
  };

  return (
    <Layout>
      <Stack
        direction="column"
        alignItems="flex-start"
        sx={{ maxWidth: "990px", margin: "0 auto" }}
      >
        <NotificationSettingsContextProvider>
          <Button
            color="secondary"
            startIcon={<ArrowBackIcon />}
            onAuxClick={returnToSettings}
            onClick={returnToSettings}
          >
            Back to settings
          </Button>
          <PageTitle sx={{ marginTop: (theme) => theme.spacing(2.5) }}>
            Notification settings
          </PageTitle>

          <ReturnToJobsAlert />

          <SectionTitle>Channels</SectionTitle>

          <Typography>Choose where you want to get notified</Typography>

          <WebhookList />

          <SectionTitle>Events</SectionTitle>

          <Typography>Choose when you want to get notified</Typography>

          <NotificationEventsForm />
        </NotificationSettingsContextProvider>
      </Stack>
    </Layout>
  );
};
