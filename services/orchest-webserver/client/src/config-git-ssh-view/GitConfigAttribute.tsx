import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useTextField } from "@/hooks/useTextField";
import { GitConfig } from "@/types";
import { omit, prune } from "@/utils/record";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import shallow from "zustand/shallow";

type GitConfigAttributeProps = {
  name: keyof Omit<GitConfig, "uuid">;
  label: string;
  errorMessage: string;
  predicate: (value: string) => boolean;
};

/**
 * Text field that is used to show and update Git Config.
 * Possible fields include `name` and `email`.
 */
export const GitConfigAttribute = ({
  name,
  label,
  errorMessage,
  predicate,
}: GitConfigAttributeProps) => {
  const {
    value,
    setValue,
    handleChange,
    isValid,
    isDirty,
    setAsDirtyOnBlur: handleBlur,
  } = useTextField(predicate);

  useInitGitConfigAttribute(name, setValue);
  useUpdateGitConfigAttribute(name, value.trim());

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
  setValue: React.Dispatch<React.SetStateAction<string>>
) => {
  const initialConfig = useGitConfigsApi(
    (state) => state.config,
    (prev) => hasValue(prev) // Only re-render if previous value is undefined.
  );

  React.useEffect(() => {
    if (initialConfig) setValue(initialConfig[name]);
  }, [setValue, initialConfig, name]);
};

const GIT_CONFIG_KEYS: (keyof GitConfig)[] = ["uuid", "name", "email"];

/** Watch the change of the attribute and update BE accordingly. */
const useUpdateGitConfigAttribute = (
  name: keyof Omit<GitConfig, "uuid">,
  value: string
) => {
  const newConfig = useGitConfigsApi((state) => {
    if (!state.config || !value) return;
    if (value === state.config[name]) return;

    const updatedValue = prune({ ...state.config, [name]: value });
    const hasAllKeys = GIT_CONFIG_KEYS.every((key) =>
      hasValue(updatedValue[key])
    );

    return hasAllKeys ? omit(updatedValue, "uuid") : undefined;
  }, shallow);

  const payload = useDebounce(newConfig, 250);

  const { run } = useAsync();
  const requestToUpdate = useGitConfigsApi((state) => state.updateConfig);

  React.useEffect(() => {
    if (payload) run(requestToUpdate(payload));
  }, [payload, requestToUpdate, run]);
};
