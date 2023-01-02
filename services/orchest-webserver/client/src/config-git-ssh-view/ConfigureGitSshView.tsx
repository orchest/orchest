import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { useFetchGitConfigs } from "@/hooks/useFetchGitConfigs";
import { useFetchSshKeys } from "@/hooks/useFetchSshKeys";
import { useTextField } from "@/hooks/useTextField";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React from "react";
import { GitConfigAttribute } from "./GitConfigAttribute";

export const ConfigureGitSshView = () => {
  const sshKeys = useGitConfigsApi((state) => state.sshKeys || []);
  const [isSshKeyDialogOpen, setIsSshKeyDialogOpen] = React.useState(false);
  const showAddSshKeyDialog = () => setIsSshKeyDialogOpen(true);
  const closeAddSshKeyDialog = () => setIsSshKeyDialogOpen(false);
  return (
    <GitSshLayout>
      <Stack spacing={2}>
        <Stack spacing={2}>
          <Typography variant="h5" gutterBottom>
            Git user configuration
          </Typography>
          <GitConfigAttribute
            name="name"
            label="Username"
            predicate={(value) => value.trim().length > 0}
            errorMessage="Username cannot be blank."
          />
          <GitConfigAttribute
            name="email"
            label="Email"
            predicate={(value) => /^\S+@\S+\.\S+$/.test(value.trim())}
            errorMessage="Invalid email"
          />
        </Stack>
        <Stack spacing={2}>
          <Typography variant="h5" gutterBottom>
            SSH keys
          </Typography>
          <MenuList>
            {sshKeys.map((sshKey) => {
              return (
                <MenuItem key={sshKey.uuid} divider>
                  <Stack direction="row" alignItems="center">
                    <Box>{sshKey.name}</Box>
                    <Box>{sshKey.created_time}</Box>
                  </Stack>
                </MenuItem>
              );
            })}
          </MenuList>
          <Button startIcon={<AddIcon />} onClick={showAddSshKeyDialog}>
            Add ssh key
          </Button>
        </Stack>
      </Stack>
      <CreateSshKeyDialog
        isOpen={isSshKeyDialogOpen}
        close={closeAddSshKeyDialog}
      />
    </GitSshLayout>
  );
};

const GitSshLayout: React.FC = ({ children }) => {
  useFetchGitConfigs();
  useFetchSshKeys();
  return (
    <SettingsViewLayout
      header={
        <Typography variant="h4" flex={1}>
          Git & SSH
        </Typography>
      }
    >
      {children}
    </SettingsViewLayout>
  );
};

type CreateSshKeyDialogProps = {
  isOpen: boolean;
  close: () => void;
};

const CreateSshKeyDialog = ({ isOpen, close }: CreateSshKeyDialogProps) => {
  const createSshKey = useGitConfigsApi((state) => state.createSshKey);
  const { run, status } = useAsync();

  const [key, setKey] = React.useState("");
  const [name, setNickname] = React.useState("");

  const save = async () => {
    if (!name || !key) return;
    await run(createSshKey({ name, key }));
    close();
  };
  return (
    <Dialog open={isOpen}>
      <DialogTitle>Add SSH Key</DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={status !== "PENDING" ? close : undefined}>
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
    />
  );
};
