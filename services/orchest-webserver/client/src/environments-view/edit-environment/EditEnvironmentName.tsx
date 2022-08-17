import { useCustomRoute } from "@/hooks/useCustomRoute";
import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

export const EditEnvironmentName = () => {
  const { environmentUuid } = useCustomRoute();
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();
  const [value = "", setValue] = React.useState<string>();
  const [hasEdited, setHasEdited] = React.useState(false);

  React.useEffect(() => {
    if (
      environmentUuid &&
      environmentUuid === environmentOnEdit?.uuid &&
      environmentOnEdit?.name
    ) {
      setValue(environmentOnEdit?.name);
    }
  }, [environmentOnEdit, environmentUuid]);

  const isInvalid = hasEdited && value.trim().length === 0;

  return (
    <TextField
      required
      value={value}
      onFocus={() => setHasEdited(true)}
      onChange={(e) => {
        setValue(e.target.value);
        if (e.target.value !== "") {
          setEnvironmentOnEdit({ name: e.target.value.trim() });
        }
      }}
      InputLabelProps={{ required: false }}
      error={isInvalid}
      helperText={isInvalid ? "Environment name cannot be blank" : " "}
      label="Environment name"
      disabled={isEnvironmentBuilding(environmentOnEdit?.latestBuild)}
      sx={{ width: { xs: "100%", lg: "50%" } }}
    />
  );
};
