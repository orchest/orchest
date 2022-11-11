import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EnvironmentName = () => {
  const name = useEditEnvironment((state) => state.changes?.name);

  const isNameEmpty = name?.trim().length === 0;

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
      {isNameEmpty ? "(Unnamed)" : name}
    </Typography>
  );
};
