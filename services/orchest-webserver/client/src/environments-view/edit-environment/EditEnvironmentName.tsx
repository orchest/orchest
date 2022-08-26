import { useCustomRoute } from "@/hooks/useCustomRoute";
import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EditEnvironmentName = () => {
  const { environmentUuid } = useCustomRoute();

  const uuid = useEditEnvironment((state) => state.environmentChanges?.uuid);
  const name = useEditEnvironment((state) => state.environmentChanges?.name);
  const latestBuild = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild
  );
  const setEnvironmentChanges = useEditEnvironment(
    (state) => state.setEnvironmentChanges
  );

  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  const isEnvironmentLoaded = environmentUuid && environmentUuid === uuid;

  React.useEffect(() => {
    if (isEnvironmentLoaded && name) {
      setValue(name);
    }
  }, [name, isEnvironmentLoaded, environmentUuid]);

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
      disabled={isEnvironmentBuilding(latestBuild)}
      sx={{ width: { xs: "100%", lg: "50%" } }}
    />
  );
};
