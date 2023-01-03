import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { IconButton } from "@/components/common/IconButton";
import { useFetchGitConfigs } from "@/hooks/useFetchGitConfigs";
import { useFetchSshKeys } from "@/hooks/useFetchSshKeys";
import { useOpenDialog } from "@/hooks/useOpenDialog";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import { humanizeDate } from "@/utils/date-time";
import { ellipsis } from "@/utils/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateSshKeyDialog } from "./CreateSshKeyDialog";
import { DeleteSshKeyDialog } from "./DeleteSshKeyDialog";
import { GitConfigAttribute } from "./GitConfigAttribute";

export const ConfigureGitSshView = () => {
  const sshKeys = useGitConfigsApi((state) => state.sshKeys || []);
  const [
    isCreateSshKeyDialogOpen,
    showCreateAddSshKeyDialog,
    closeCreateAddSshKeyDialog,
  ] = useOpenDialog();

  const [sshKeyUuidToDelete, setSshKeyUuidToDelete] = React.useState<
    string | undefined
  >();
  const sshKeyToDelete = React.useMemo(
    () => sshKeys.find((key) => key.uuid === sshKeyUuidToDelete),
    [sshKeyUuidToDelete, sshKeys]
  );

  const showDeleteSshKeyDialog = (uuid: string) => setSshKeyUuidToDelete(uuid);
  const closeDeleteSshKeyDialog = () => setSshKeyUuidToDelete(undefined);

  return (
    <GitSshLayout>
      <Stack spacing={2}>
        <Stack direction="column" spacing={2}>
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
        <Stack direction="column" alignItems="flex-start" spacing={2}>
          <Typography variant="h5" gutterBottom>
            SSH keys
          </Typography>
          <MenuList
            sx={{
              minWidth: (theme) => ({ xs: "95%", md: theme.spacing(100) }),
            }}
          >
            {sshKeys.map((sshKey) => {
              return (
                <MenuItem key={sshKey.uuid} divider sx={{ width: "100%" }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ width: "100%" }}
                  >
                    <Box sx={{ flex: 1, ...ellipsis() }}>{sshKey.name}</Box>
                    <Box sx={{ flex: 1 }}>
                      {humanizeDate(sshKey.created_time, "yyyy-MM-dd")}
                    </Box>
                    <Box>
                      <IconButton
                        title="Delete key"
                        onClick={() => showDeleteSshKeyDialog(sshKey.uuid)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Stack>
                </MenuItem>
              );
            })}
          </MenuList>
          <Button startIcon={<AddIcon />} onClick={showCreateAddSshKeyDialog}>
            Add ssh key
          </Button>
        </Stack>
      </Stack>
      <CreateSshKeyDialog
        isOpen={isCreateSshKeyDialogOpen}
        close={closeCreateAddSshKeyDialog}
      />
      <DeleteSshKeyDialog
        sshKey={sshKeyToDelete}
        close={closeDeleteSshKeyDialog}
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
