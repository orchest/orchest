import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { useTextField } from "@/hooks/useTextField";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import React from "react";

type CreateSshKeyDialogProps = {
  isOpen: boolean;
  close: () => void;
};

export const CreateSshKeyDialog = ({
  isOpen,
  close,
}: CreateSshKeyDialogProps) => {
  const createSshKey = useGitConfigsApi((state) => state.createSshKey);
  const { run, status } = useAsync();

  const [key, setKey] = React.useState("");
  const [name, setNickname] = React.useState("");

  const save = async () => {
    if (!name || !key) return;
    await run(createSshKey({ name, key }));
    close();
  };

  const onClose = status !== "PENDING" ? close : undefined;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Add SSH Key</DialogTitle>
      <DialogContent>
        <Alert
          severity="warning"
          sx={{ marginTop: (theme) => theme.spacing(1) }}
        >
          SSH key passphrases are not supported
        </Alert>
        <Stack direction="column">
          <SshAttribute
            name="key"
            label="SSH Key"
            onChangeValue={setKey}
            predicate={(value) => value.trim().length > 0}
            errorMessage="SSH key cannot be blank."
            helperMessage="Generate and paste your private key"
            multiline
          />
          <SshAttribute
            name="name"
            label="Nickname"
            onChangeValue={setNickname}
            predicate={(value) => value.trim().length > 0}
            errorMessage="Nickname cannot be blank."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button tabIndex={-1} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={status === "PENDING"}
        >
          Save key
        </Button>
      </DialogActions>
    </Dialog>
  );
};

type SshAttributeProps = {
  name: "key" | "name";
  label: "SSH Key" | "Nickname";
  errorMessage: string;
  helperMessage?: string;
  predicate: (value: string) => boolean;
  onChangeValue: (value: string) => void;
  multiline?: boolean;
};

export const SshAttribute = ({
  name,
  label,
  errorMessage,
  helperMessage,
  predicate,
  onChangeValue,
  multiline,
}: SshAttributeProps) => {
  const {
    value,
    handleChange,
    isValid,
    isDirty,
    setAsDirtyOnBlur: handleBlur,
  } = useTextField(predicate);

  const error = React.useMemo(() => {
    if (isDirty && !isValid) return errorMessage;
    return helperMessage ?? DEFAULT_HELPER_TEXT;
  }, [isDirty, isValid, errorMessage, helperMessage]);

  const showError = ![helperMessage, DEFAULT_HELPER_TEXT].includes(error);

  return (
    <TextField
      value={value}
      onChange={(event) => {
        handleChange(event);
        onChangeValue(event.target.value);
      }}
      onBlur={handleBlur()}
      label={label}
      name={name}
      required
      multiline={multiline}
      error={showError}
      helperText={error}
      sx={{ marginTop: (theme) => theme.spacing(2) }}
    />
  );
};

const DEFAULT_HELPER_TEXT = " ";
