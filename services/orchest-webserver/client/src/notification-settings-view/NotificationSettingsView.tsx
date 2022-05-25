import { PageTitle } from "@/components/common/PageTitle";
import { SectionTitle } from "@/components/common/SectionTitle";
import { Layout } from "@/components/Layout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import React from "react";
import { useFetchNotificationEventTypes } from "./useFetchNotificationEventTypes";

const ReturnToJobsAlert = () => {
  const { navigateTo, prevPathname } = useCustomRoute();
  const returnToJobs = () => {
    navigateTo(siteMap.jobs.path);
  };
  // TODO: uncomment this
  //   const showReturnToJobsAlert = prevPathname === siteMap.jobs.path;
  const showReturnToJobsAlert = true;

  return showReturnToJobsAlert ? (
    <Alert
      severity="warning"
      action={
        <Button color="inherit" size="small" onClick={returnToJobs}>
          Return to Jobs
        </Button>
      }
      sx={{ margin: (theme) => theme.spacing(2, 0) }}
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

  useFetchNotificationEventTypes();

  return (
    <Layout>
      <Box sx={{ maxWidth: "1200px" }}>
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

        <SectionTitle>Events</SectionTitle>

        <Typography>Choose when you want to get notified</Typography>
      </Box>
    </Layout>
  );
};
