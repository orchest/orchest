import { STATUS } from "@/hooks/useAsync";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { hasValue, validURL } from "@orchest/lib-utils";
import React from "react";
import { webhookStatusMessage } from "../WebhookVerifiedCheck";

export const WebhookUrlField = ({
  value,
  onChange,
  disabled,
  isVerifiedStatus,
  verifyUrl,
}: {
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
  disabled: boolean;
  isVerifiedStatus: STATUS;
  verifyUrl: () => void;
}) => {
  const [isBlurred, setIsBlurred] = React.useState(false);
  const validation = React.useMemo(() => {
    if (!isBlurred) return undefined;
    if (value.length > 0 && !validURL(value, true)) return "Invalid URL";
    return undefined;
  }, [value, isBlurred]);

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        fullWidth
        autoFocus
        required
        onBlur={() => setIsBlurred(true)}
        sx={{ marginTop: (theme) => theme.spacing(2) }}
        label="Webhook URL"
        error={hasValue(validation)}
        disabled={disabled}
        helperText={
          validation || "Activate incoming webhooks on desired channel"
        }
        value={value}
        InputProps={{
          endAdornment: webhookStatusMessage[isVerifiedStatus]?.component,
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button disabled={disabled} onClick={verifyUrl}>
        Test
      </Button>
    </Stack>
  );
};
