import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

export const EditEnvironmentName = () => {
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  return (
    <TextField
      required
      value={environmentOnEdit?.name || ""}
      onChange={(e) => {
        setEnvironmentOnEdit({ name: e.target.value });
      }}
      InputLabelProps={{ required: false }}
      label="Environment name"
      disabled={isEnvironmentBuilding(environmentOnEdit?.latestBuild)}
      sx={{ width: { xs: "100%", lg: "50%" } }}
    />
  );
};
