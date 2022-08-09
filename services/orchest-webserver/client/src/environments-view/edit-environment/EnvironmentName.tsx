import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

export const EnvironmentName = () => {
  const { environmentOnEdit } = useEnvironmentOnEdit();

  return (
    <Typography variant="h4" flex={1} sx={ellipsis()}>
      {environmentOnEdit?.name}
    </Typography>
  );
};
