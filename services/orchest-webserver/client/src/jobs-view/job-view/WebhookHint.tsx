import { SnackBar } from "@/components/common/SnackBar";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { siteMap } from "@/routingConfig";
import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

export const WebhookHint = () => {
  const { webhooks } = useAppContext();
  const { navigateTo } = useCustomRoute();
  const goToNotificationSettings = () => {
    navigateTo(siteMap.notificationSettings.path);
  };
  const [shouldHideWebhookHint, setShouldHideWebhookHint] = useLocalStorage(
    "hide_webhook_hint",
    false
  );

  const jobStatus = useEditJob((state) => state.jobChanges?.status);

  const hasStartedJob = useHasChanged(
    jobStatus,
    (prev, curr) =>
      prev === "DRAFT" && (curr === "PENDING" || curr === "STARTED")
  );

  const shouldShowWebhookHint =
    !shouldHideWebhookHint && webhooks.length === 0 && hasStartedJob;

  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => {
    if (shouldShowWebhookHint) setShowHint(true);
  }, [shouldShowWebhookHint]);

  const closeHintAndDisable = () => {
    setShouldHideWebhookHint(true);
    setShowHint(false);
  };

  const action = (
    <>
      <Button size="small" onClick={goToNotificationSettings}>
        New hook
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={closeHintAndDisable}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </>
  );

  return (
    <SnackBar
      open={showHint}
      autoHideDuration={6000}
      onClose={closeHintAndDisable}
      message="Use webhooks to get notified when pipeline runs fail"
      action={action}
    />
  );
};
