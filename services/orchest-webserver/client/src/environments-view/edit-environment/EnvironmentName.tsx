import TextField from "@mui/material/TextField";
import React from "react";
import { isEnvironmentBuilding } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

export const EnvironmentName = () => {
  const { environmentOnEdit, setEnvironmentOnEdit } = useEnvironmentOnEdit();

  return (
    <TextField
      required
      value={environmentOnEdit?.name || ""}
      onChange={(e) => {
        setEnvironmentOnEdit({ name: e.target.value });
      }}
      label="Environment name"
      autoFocus
      disabled={isEnvironmentBuilding(environmentOnEdit?.latestBuild)}
    />
  );
};
