import { useTextField } from "@/hooks/useTextField";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React from "react";

export const ConfigureGitSshView = () => {
  const {
    value: username,
    handleChange: handleChangeUsername,
    isValid: isValidUserName,
    isDirty: isUsernameDirty,
    setAsDirtyOnBlur: onBlurUsername,
  } = useTextField((value) => value.trim().length === 0);
  const usernameError = React.useMemo(() => {
    if (isUsernameDirty && !isValidUserName) return "Username cannot be blank.";
    return " ";
  }, [isUsernameDirty, isValidUserName]);

  const {
    value: email,
    handleChange: handleChangeEmail,
    isValid: isValidEmail,
    isDirty: isEmailDirty,
    setAsDirtyOnBlur: onBlurEmail,
  } = useTextField((value) => /^\S+@\S+\.\S+$/.test(value.trim()));
  const emailError = React.useMemo(() => {
    if (isEmailDirty && !isValidEmail) return "Invalid email";
    return " ";
  }, [isEmailDirty, isValidEmail]);
  return (
    <SettingsViewLayout
      header={
        <Typography variant="h4" flex={1}>
          Git & SSH
        </Typography>
      }
    >
      <Stack spacing={2}>
        <Typography variant="h5" gutterBottom>
          Git user configuration
        </Typography>
        <TextField
          value={username}
          onChange={handleChangeUsername}
          onBlur={onBlurUsername()}
          label="Username"
          name="username"
          error={usernameError !== " "}
          helperText={usernameError}
          sx={{ width: "50%", minWidth: (theme) => theme.spacing(50) }}
        />
        <TextField
          value={email}
          onChange={handleChangeEmail}
          onBlur={onBlurEmail()}
          label="Email"
          name="email"
          error={emailError !== " "}
          helperText={emailError}
          sx={{ width: "30%", minWidth: (theme) => theme.spacing(50) }}
        />
      </Stack>
    </SettingsViewLayout>
  );
};
