import { useCustomRoute } from "@/hooks/useCustomRoute";
import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EditEnvironmentName = () => {
  const { environmentUuid } = useCustomRoute();
  const { environmentChanges, setEnvironmentChanges } = useEditEnvironment();
  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  React.useEffect(() => {
    if (
      environmentUuid &&
      environmentUuid === environmentChanges?.uuid &&
      environmentChanges?.name
    ) {
      setValue(environmentChanges?.name);
    }
  }, [environmentChanges, environmentUuid]);

  const isInvalid = hasEdited && value.trim().length === 0;

  return (
    <TextField
      required
      value={value}
      onFocus={() => setHasEdited(true)}
      onBlur={() => setEnvironmentChanges({ name: value.trim() })}
      onChange={({ target }) => {
        setValue(target.value);

        if (target.value) {
          setEnvironmentChanges({ name: target.value });
        }
      }}
      InputLabelProps={{ required: false }}
      error={isInvalid}
      helperText={isInvalid ? "Environment name cannot be blank" : " "}
      label="Environment name"
      disabled={isEnvironmentBuilding(environmentChanges?.latestBuild)}
      sx={{ width: { xs: "100%", lg: "50%" } }}
    />
  );
};
