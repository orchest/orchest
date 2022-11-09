import { useCustomRoute } from "@/hooks/useCustomRoute";
import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EditEnvironmentName = () => {
  const { environmentUuid } = useCustomRoute();

  const uuid = useEditEnvironment((state) => state.changes?.uuid);
  const name = useEditEnvironment((state) => state.changes?.name);
  const latestBuildStatus = useEditEnvironment(
    (state) => state.changes?.latestBuild?.status
  );
  const setEnvironmentChanges = useEditEnvironment((state) => state.update);

  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  const isEnvironmentLoaded = environmentUuid && environmentUuid === uuid;

  React.useEffect(() => {
    if (isEnvironmentLoaded && name) {
      setValue(name);
    }
  }, [name, isEnvironmentLoaded, environmentUuid]);

  const isInvalid = hasEdited && value.trim().length === 0;

  const handleChange = ({
    target,
  }: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(target.value);
    if (target.value) setEnvironmentChanges({ name: target.value });
  };

  return (
    <TextField
      required
      value={value}
      onFocus={() => setHasEdited(true)}
      onBlur={() => setEnvironmentChanges({ name: value.trim() })}
      onChange={handleChange}
      InputLabelProps={{ required: false }}
      error={isInvalid}
      helperText={isInvalid ? "Environment name cannot be blank" : " "}
      label="Environment name"
      disabled={isEnvironmentBuilding(latestBuildStatus)}
      sx={{ width: { xs: "100%", lg: "49%" } }}
    />
  );
};
