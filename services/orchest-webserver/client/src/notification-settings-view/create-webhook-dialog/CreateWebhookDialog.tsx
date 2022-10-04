import { useAppContext } from "@/contexts/AppContext";
import { useGlobalContext } from "@/contexts/GlobalContext";
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
import { ContentType, hasValue, validURL } from "@orchest/lib-utils";
import React from "react";
import { displayEventMappings } from "../common";
import { WebhookSpec } from "../notification-webhooks";
import { useNotificationSettingsContext } from "../NotificationSettingsContext";
import { WebhookDocLink } from "../WebhookDocLink";
import { useCreateWebhook } from "./useCreateWebhook";
import { useVerifyWebhookUrl } from "./useVerifyWebhookUrl";
import { WebhookUrlField } from "./WebhookUrlField";

const contentTypes: ContentType[] = [
  "application/x-www-form-urlencoded",
  "application/json",
];

export const CreateWebhookDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { setWebhooks, fetchWebhooks } = useAppContext();
  const { enabledEventTypes } = useNotificationSettingsContext();
  const { setAlert } = useGlobalContext();

  const [webhookName, setWebhookName] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [contentType, setContentType] = React.useState<ContentType>(
    "application/json"
  );

  const [isSslEnabled, setIsSslEnabled] = React.useState(false);

  const webhookSpec = React.useMemo<Omit<WebhookSpec, "url">>(() => {
    return {
      name: webhookName,
      secret,
      content_type: contentType,
      verify_ssl: isSslEnabled,
      subscriptions: enabledEventTypes
        .flatMap(
          (eventsForDisplay) => displayEventMappings[eventsForDisplay] || []
        )
        .map((event_type) => ({ event_type })),
    };
  }, [enabledEventTypes, contentType, isSslEnabled, secret, webhookName]);

  const {
    webhookUrl,
    setWebhookUrl,
    status,
    verifyUrl,
    isSslAllowed,
  } = useVerifyWebhookUrl(webhookSpec);

  React.useEffect(() => {
    setIsSslEnabled(isSslAllowed);
  }, [isSslAllowed]);

  const closeDialog = () => {
    onClose();
    setWebhookUrl("");
  };

  const { createWebhook, status: createHookStatus } = useCreateWebhook({
    ...webhookSpec,
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

  const webhookUrlValidation = React.useMemo(() => {
    const trimmedUrl = webhookUrl.trim();
    if (trimmedUrl.length === 0) return "URL is required";
    if (!validURL(trimmedUrl, true)) return "Invalid URL";
    return undefined;
  }, [webhookUrl]);

  return (
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
              validation={webhookUrlValidation}
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
                onChange={(e) => setContentType(e.target.value as ContentType)}
              >
                {contentTypes.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              sx={{ marginTop: (theme) => theme.spacing(2) }}
              label="Webhook name"
              helperText={"For telling apart webhooks with similar URLs"}
              disabled={isCreating}
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
            />
            <TextField
              fullWidth
              sx={{ marginTop: (theme) => theme.spacing(2) }}
              label="Secret"
              helperText="This secret will be used to securely sign the payload."
              disabled={isCreating}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <FormControlLabel
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
                  {`SSL verification (unavailable for HTTP URLs)`}
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="primary"
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
            disabled={isCreating || hasValue(webhookUrlValidation)}
          >
            Save webhook
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
