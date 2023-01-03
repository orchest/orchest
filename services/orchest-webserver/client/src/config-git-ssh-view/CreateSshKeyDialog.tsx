import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { useTextField } from "@/hooks/useTextField";
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
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Add SSH Key</DialogTitle>
      <DialogContent>
        <Stack direction="column">
          <SshAttribute
            name="key"
            label="SSH Key"
            onChangeValue={setKey}
            predicate={(value) => value.trim().length > 0}
            errorMessage="SSH key cannot be blank."
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
        <Button onClick={onClose}>Cancel</Button>
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
  predicate: (value: string) => boolean;
  onChangeValue: (value: string) => void;
};

export const SshAttribute = ({
  name,
  label,
  errorMessage,
  predicate,
  onChangeValue,
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
    return " ";
  }, [isDirty, isValid, errorMessage]);

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
      error={error !== " "}
      helperText={error}
      sx={{ marginTop: (theme) => theme.spacing(2) }}
    />
  );
};
