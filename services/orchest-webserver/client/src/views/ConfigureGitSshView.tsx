import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const ConfigureGitSshView = () => {
  return (
    <SettingsViewLayout
      header={
        <Typography variant="h4" flex={1}>
          Git & SSH
        </Typography>
      }
    >
      <Stack sx={{ marginTop: (theme) => theme.spacing(2) }}>Git</Stack>
    </SettingsViewLayout>
  );
};
