import { useFetchGitConfigs } from "@/hooks/useFetchGitConfigs";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { GitConfigAttribute } from "./GitConfigAttribute";

export const ConfigureGitSshView = () => {
  return (
    <GitSshLayout>
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
    </GitSshLayout>
  );
};

const GitSshLayout: React.FC = ({ children }) => {
  useFetchGitConfigs();
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
