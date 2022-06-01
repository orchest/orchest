import { useAppContext } from "@/contexts/AppContext";
import { useAppInnerContext } from "@/contexts/AppInnerContext";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ContentType } from "@orchest/lib-utils";
import React from "react";
import { useNotificationSettingsContext } from "../NotificationSettingsContext";
import { WebhookDocLink } from "../WebhookDocLink";
import { SubscriberPayload, useCreateWebhook } from "./useCreateWebhook";
import { useVerifyWebhookUrl } from "./useVerifyWebhookUrl";
import { WebhookUrlField } from "./WebhookUrlField";

const contentTypes: ContentType[] = [
  "application/x-www-form-urlencoded",
  "application/json",
];

export const CreateWebhookDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose, children }) => {
  const { setWebhooks, fetchWebhooks } = useAppInnerContext();
  const { notificationEventTypes } = useNotificationSettingsContext();
  const { setAlert } = useAppContext();

  const [webhookName, setWebhookName] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [contentType, setContentType] = React.useState<ContentType>(
    "application/json"
  );

  const [isSslEnabled, setIsSslEnabled] = React.useState(false);

  const webhookPayload = React.useMemo<Omit<SubscriberPayload, "url">>(() => {
    return {
      name: webhookName,
      secret,
      content_type: contentType,
      verify_ssl: isSslEnabled,
      subscriptions: notificationEventTypes.map((type) => ({
        event_type: type.name,
      })),
    };
  }, [notificationEventTypes, contentType, isSslEnabled, secret, webhookName]);

  const {
    webhookUrl,
    setWebhookUrl,
    status,
    verifyUrl,
    isSslAllowed,
  } = useVerifyWebhookUrl(webhookPayload);

  React.useEffect(() => {
    setIsSslEnabled(isSslAllowed);
  }, [isSslAllowed]);

  const closeDialog = () => {
    onClose();
    setWebhookUrl("");
  };

  const { createWebhook, status: createHookStatus } = useCreateWebhook({
    ...webhookPayload,
    url: webhookUrl,
  });

  const isCreating = createHookStatus === "PENDING";

  const onClickCreateWebhook = async () => {
    try {
      const newWebhook = await createWebhook();
      if (!newWebhook) {
        fetchWebhooks();
        return;
      }
      setWebhooks((current) =>
        current ? [...current, newWebhook] : [newWebhook]
      );
    } catch (error) {
      setAlert("Error", `Failed to create webhook. ${error.message || ""}`);
    }
    closeDialog();
  };

  return (
    <>
      {children}
      <Dialog
        open={isOpen}
        onClose={!isCreating ? closeDialog : undefined}
        fullWidth
        maxWidth="sm"
      >
        <form
          id="create-webhook"
          onSubmit={(e) => {
            e.preventDefault();
            onClickCreateWebhook();
          }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
            }}
          >
            New webhook
            <WebhookDocLink>Docs</WebhookDocLink>
          </DialogTitle>
          <DialogContent>
            <Stack direction="column" spacing={3}>
              <WebhookUrlField
                value={webhookUrl}
                onChange={setWebhookUrl}
                isVerifiedStatus={status}
                verifyUrl={verifyUrl}
                disabled={isCreating}
              />
              <FormControl fullWidth>
                <InputLabel id="content-type">Content type</InputLabel>
                <Select<ContentType>
                  labelId="content-type"
                  id="content-type"
                  value={contentType}
                  label="Content type"
                  disabled={isCreating}
                  onChange={(e) =>
                    setContentType(e.target.value as ContentType)
                  }
                >
                  {contentTypes.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
                {/* <FormHelperText> </FormHelperText> */}
              </FormControl>
              <TextField
                fullWidth
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                label="Webhook name"
                helperText={"For telling apart webhooks with similar URL's"}
                disabled={isCreating}
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
              />
              <TextField
                fullWidth
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                label="Secret"
                helperText={
                  "Generate secret and paste here and use this secret to verify the incoming notification"
                }
                disabled={isCreating}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <FormControlLabel
                onClick={() => {
                  // if (isSslAllowed) setIsSslEnabled((value) => !value);
                }}
                disableTypography
                control={
                  <Switch
                    disabled={!isSslAllowed || isCreating}
                    size="small"
                    inputProps={{
                      "aria-label": `${
                        isSslEnabled ? "Disable" : "Enable"
                      } SSL verification`,
                    }}
                    sx={{ margin: (theme) => theme.spacing(0, 1) }}
                    checked={isSslEnabled}
                    onChange={(_, checked) => setIsSslEnabled(checked)}
                  />
                }
                label={
                  <Typography variant="caption">
                    {`SSL verification (unavailable for HTTP URL's)`}
                  </Typography>
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              color="secondary"
              tabIndex={-1}
              disabled={isCreating}
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              form="create-webhook"
              disabled={isCreating}
            >
              Save webhook
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};
