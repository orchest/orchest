import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

type EnvironmentOption = {
  value: string;
  label: string;
};

export const SelectEnvironment = ({
  value,
  onChange,
  disabled,
  queryString,
}: {
  value: string;
  onChange: (
    updatedEnvironmentUUID: string,
    updatedEnvironmentName: string,
    skipSave?: boolean | undefined
  ) => void;
  disabled: boolean;
  queryString: string;
}) => {
  const { projectUuid } = useCustomRoute();

  const { environments } = useFetchEnvironments(projectUuid, queryString);

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
      (option) => option.value === value // `value` are uuid of the environment
    );

    const fallbackSelection =
      environmentOptions.length > 0
        ? environmentOptions[0]
        : { value: "", label: "" };

    const selection = currentEnvironment || fallbackSelection;

    onChange(
      selection.value,
      selection.label,
      hasValue(currentEnvironment) // skip saving if it's already current environment
    );
  }, [environmentOptions, onChange, value]);

  return (
    <FormControl fullWidth>
      <InputLabel id="environment-label">Environment</InputLabel>
      <Select
        label="Environment"
        labelId="environment-label"
        id="environment"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const selected = (environmentOptions || []).find(
            (option) => option.value === e.target.value
          );
          if (selected) onChange(selected.value, selected.label);
        }}
      >
        {!environmentOptions ? (
          <MenuItem>Loading...</MenuItem>
        ) : (
          environmentOptions.map((option) => {
            return (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            );
          })
        )}
      </Select>
    </FormControl>
  );
};
