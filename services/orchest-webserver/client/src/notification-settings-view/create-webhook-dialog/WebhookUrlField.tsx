import { AsyncStatus } from "@/hooks/useAsync";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { webhookStatusMessage } from "../WebhookVerifiedCheck";

const defaultHelperText = "Activate incoming webhooks on desired channel";

export const WebhookUrlField = ({
  value,
  onChange,
  validation,
  disabled,
  isVerifiedStatus,
  verifyUrl,
}: {
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
  validation: string | undefined;
  disabled: boolean;
  isVerifiedStatus: AsyncStatus;
  verifyUrl: () => void;
}) => {
  const [isBlurred, setIsBlurred] = React.useState(false);

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        fullWidth
        autoFocus
        required
        type="url"
        onBlur={() => setIsBlurred(true)}
        sx={{ marginTop: (theme) => theme.spacing(2) }}
        label="Webhook URL"
        error={isBlurred && value.length > 0 && hasValue(validation)}
        disabled={disabled}
        helperText={
          isBlurred ? validation || defaultHelperText : defaultHelperText
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
