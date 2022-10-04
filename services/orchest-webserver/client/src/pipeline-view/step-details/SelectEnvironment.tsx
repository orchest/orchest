import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { Language } from "@/types";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { StepCreateEnvironmentButton } from "./StepCreateEnvironmentButton";

type EnvironmentOption = {
  value: string;
  label: string;
};

type SelectEnvironmentProps = {
  value: string;
  onChange: (
    updatedEnvironmentUUID: string,
    updatedEnvironmentName: string,
    skipSave?: boolean
  ) => void;
  disabled: boolean;
  language: string;
};

export const SelectEnvironment = ({
  value,
  onChange,
  disabled,
  language,
}: SelectEnvironmentProps) => {
  const { isReadOnly } = usePipelineDataContext();
  const allEnvironments = useEnvironmentsApi(
    (state) => state.environments || []
  );

  const environments = React.useMemo(() => {
    return allEnvironments.filter(
      (environment) => environment.language === language
    );
  }, [allEnvironments, language]);

  const environmentOptions = React.useMemo<
    EnvironmentOption[] | undefined
  >(() => {
    if (!environments) return environments;
    return environments.map((environment) => {
      return {
        value: environment.uuid,
        label: environment.name,
      };
    });
  }, [environments]);

  React.useEffect(() => {
    if (!environmentOptions) return;

    const currentEnvironment = environmentOptions.find(
      (option) => option.value === value // `value` is uuid of the environment
    );

    const fallbackSelection = isReadOnly
      ? { value: "", label: "" }
      : environmentOptions.length > 0
      ? environmentOptions[0]
      : { value: "", label: "" };

    const selection = currentEnvironment || fallbackSelection;

    onChange(
      selection.value,
      selection.label,
      hasValue(currentEnvironment) // skip saving if it's already current environment
    );
  }, [environmentOptions, onChange, value, isReadOnly]);

  const validValue = React.useMemo(() => {
    if (environmentOptions?.some((option) => option.value === value))
      return value;
    return "";
  }, [environmentOptions, value]);

  const showCreateEnvironmentButton = environmentOptions?.length === 0;

  return (
    <>
      <StepCreateEnvironmentButton
        language={language as Language}
        visible={showCreateEnvironmentButton}
      />
      {!showCreateEnvironmentButton && (
        <FormControl fullWidth>
          <InputLabel id="environment-label">Environment</InputLabel>
          {!hasValue(environmentOptions) ? (
            <Select label="Environment" placeholder="Loading …" value="" />
          ) : (
            <Select
              label="Environment"
              labelId="environment-label"
              id="environment"
              value={validValue}
              disabled={disabled}
              onChange={({ target }) => {
                const selected = environmentOptions.find(
                  (option) => option.value === target.value
                );
                if (selected) onChange(selected.value, selected.label);
              }}
            >
              {environmentOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      )}
    </>
  );
};
