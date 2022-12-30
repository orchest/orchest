import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useTextField } from "@/hooks/useTextField";
import { GitConfig } from "@/types";
import { omit } from "@/utils/record";
import TextField from "@mui/material/TextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

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
  const config = useGitConfigsApi((state) => state.config);
  const shouldInit = useHasChanged(
    config,
    (prev, curr) => !hasValue(prev) && hasValue(curr)
  );
  React.useEffect(() => {
    if (shouldInit && config) setValue(config[name]);
  }, [shouldInit, setValue, config, name]);
};

/** Watch the change of the attribute and update BE accordingly. */
const useUpdateGitConfigAttribute = (
  name: keyof Omit<GitConfig, "uuid">,
  value: string
) => {
  const config = useGitConfigsApi((state) => state.config);

  const updatedValue =
    hasValue(config) && value !== config[name] ? value : undefined;

  const debouncedValue = useDebounce(updatedValue, 250);
  const update = useGitConfigsApi((state) => state.updateConfig);

  const configRef = React.useRef(config);
  configRef.current = config;

  React.useEffect(() => {
    const config = configRef.current;
    if (!config) return;
    const restConfig = omit(config, "uuid", name);
    if (
      debouncedValue &&
      Object.values(restConfig).some((value) => (value as string).length > 0)
    )
      update({ [name]: debouncedValue, ...restConfig } as Omit<
        GitConfig,
        "uuid"
      >);
  }, [debouncedValue, update, name]);
};
