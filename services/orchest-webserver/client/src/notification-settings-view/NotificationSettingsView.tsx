import { PageTitle } from "@/components/common/PageTitle";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Layout } from "@/components/Layout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";
import { NotificationEventsForm } from "./NotificationEventsForm";
import {
  NotificationSettingsContextProvider,
  useNotificationSettingsContext,
} from "./NotificationSettingsContext";
import { WebhookList } from "./WebhookList";

const ReturnToJobsAlert = () => {
  const { navigateTo, prevPathname } = useCustomRoute();
  const { webhooks } = useNotificationSettingsContext();

  const firstSuccess = webhooks.length === 1;

  const returnToJobs = () => {
    navigateTo(siteMap.jobs.path);
  };

  return siteMap.jobs.path === prevPathname ? (
    <Alert
      severity={firstSuccess ? "success" : "info"}
      action={
        <Button color="inherit" size="small" onClick={returnToJobs}>
          Return to Jobs
        </Button>
      }
      sx={{ marginBottom: (theme) => theme.spacing(2), width: "100%" }}
    >
      {firstSuccess
        ? `You have successfully configured your first webhook!`
        : webhooks.length > 1
        ? "Webhooks are enabled"
        : "A valid Webhook URL is required for notifications to be enabled"}
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
          <WebhookList />
          <SectionTitle>Events</SectionTitle>
          <NotificationEventsForm />
        </NotificationSettingsContextProvider>
      </Stack>
    </Layout>
  );
};
