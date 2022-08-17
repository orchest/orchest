import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

export const EnvironmentName = () => {
  const { environmentOnEdit } = useEnvironmentOnEdit();

  const isNameEmpty = environmentOnEdit?.name.trim().length === 0;

  return (
    <Typography
      variant="h4"
      flex={1}
      sx={{
        ...ellipsis(),
        color: (theme) =>
          isNameEmpty ? theme.palette.action.active : "inherent",
      }}
    >
      {isNameEmpty ? "(Unnamed)" : environmentOnEdit?.name}
    </Typography>
  );
};
