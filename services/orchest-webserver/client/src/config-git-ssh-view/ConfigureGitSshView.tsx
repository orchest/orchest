import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useFetchGitConfigs } from "@/hooks/useFetchGitConfigs";
import { useFetchSshKeys } from "@/hooks/useFetchSshKeys";
import { useOpenDialog } from "@/hooks/useOpenDialog";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateSshKeyDialog } from "./CreateSshKeyDialog";
import { DeleteSshKeyDialog } from "./DeleteSshKeyDialog";
import { GitConfigAttribute } from "./GitConfigAttribute";
import { SshKeyList } from "./SshKeyList";

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
      <Stack spacing={3}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6" gutterBottom>
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
          <SshKeyList
            list={sshKeys}
            onDelete={showDeleteSshKeyDialog}
            onCreate={showCreateAddSshKeyDialog}
          />
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
        <Typography variant="h5" flex={1}>
          Git & SSH settings
        </Typography>
      }
      description={
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography color="text.secondary">
            Orchest uses the SSH protocol to securely communicate with Git.
          </Typography>
          <Link
            href="https://docs.orchest.io/en/stable/fundamentals/jobs.html"
            target="_blank"
            rel="noreferrer"
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              margin: (theme) => theme.spacing(0, 1),
            }}
          >
            Git & SSH docs
            <OpenInNewIcon
              sx={{
                fontSize: (theme) => theme.spacing(2),
                marginLeft: (theme) => theme.spacing(0.5),
              }}
            />
          </Link>
        </Stack>
      }
    >
      {children}
    </SettingsViewLayout>
  );
};
