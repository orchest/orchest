import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useTextField } from "@/hooks/useTextField";
import { GIT_CONFIG_KEYS } from "@/hooks/useUpdateGitConfig";
import { GitConfig } from "@/types";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

type GitConfigAttributeProps = {
  name: keyof Omit<GitConfig, "uuid">;
  label: string;
  errorMessage: string;
};

/**
 * Text field that is used to show and update Git Config.
 * Possible fields include `name` and `email`.
 */
export const GitConfigAttribute = ({
  name,
  label,
  errorMessage,
}: GitConfigAttributeProps) => {
  const {
    value,
    handleChange,
    isValid,
    isDirty,
    initValue,
    setAsDirtyOnBlur: handleBlur,
  } = useTextField(GIT_CONFIG_KEYS[name]);

  useInitGitConfigAttribute(name, initValue);
  const setConfig = useGitConfigsApi((state) => state.setConfig);
  React.useEffect(() => {
    setConfig((config) => ({ ...config, [name]: value }));
  }, [name, value, setConfig]);

  const error = React.useMemo(() => {
    if (isDirty && !isValid) return errorMessage;
    return " ";
  }, [isDirty, isValid, errorMessage]);

  return (
    <TextField
      value={value}
      onChange={handleChange}
      onBlur={handleBlur()}
      label={label}
      name={name}
      required
      error={error !== " "}
      helperText={error}
      sx={{ width: "30%", minWidth: (theme) => theme.spacing(50) }}
    />
  );
};

/** Initialize the attribute when config is just loaded in the store. */
const useInitGitConfigAttribute = (
  name: keyof Omit<GitConfig, "uuid">,
  initValue: (value: string) => void
) => {
  const initialConfig = useGitConfigsApi(
    (state) => state.config,
    (prev, curr) => {
      const hasLoaded = !hasValue(prev?.uuid) && hasValue(curr?.uuid);
      return !hasLoaded; // Note that this function is `equal`. It rerenders when false.
    }
  );

  const value = initialConfig?.[name];
  React.useEffect(() => {
    if (value) initValue(value);
  }, [initValue, value]);
};
