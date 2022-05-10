import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Environment } from "@/types";
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
  const [environmentOptions, setEnvironmentOptions] = React.useState<
    EnvironmentOption[]
  >();
  const { cancelableFetch } = useCancelableFetch();

  const { projectUuid } = useCustomRoute();
  const fetchEnvironmentOptions = React.useCallback(() => {
    let environmentsEndpoint = `/store/environments/${projectUuid}${queryString}`;

    cancelableFetch<Environment[]>(environmentsEndpoint)
      .then((result) => {
        let options: EnvironmentOption[] = [];

        let currentEnvironmentInEnvironments = false;

        for (let environment of result) {
          if (environment.uuid == value) {
            currentEnvironmentInEnvironments = true;
          }
          options.push({
            value: environment.uuid,
            label: environment.name,
          });
        }

        if (!currentEnvironmentInEnvironments) {
          // update environment
          onChange(
            options.length > 0 ? options[0].value : "",
            options.length > 0 ? options[0].label : "",
            true // Skip saving because this is to initialize the form
          );
        }

        setEnvironmentOptions(options);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [onChange, projectUuid, value, cancelableFetch, queryString]);

  React.useEffect(() => {
    if (hasValue(environmentOptions)) return;
    fetchEnvironmentOptions();
  }, [fetchEnvironmentOptions, environmentOptions]);
  return (
    <FormControl fullWidth>
      <InputLabel id="environment-label">Environment</InputLabel>
      <Select
        label="Kernel language"
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
        {(environmentOptions || []).map((option) => {
          return (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};
