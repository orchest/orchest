import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

export const EnvironmentName = () => {
  const { environmentChanges } = useEditEnvironment();

  const isNameEmpty = environmentChanges?.name.trim().length === 0;

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
      {isNameEmpty ? "(Unnamed)" : environmentChanges?.name}
    </Typography>
  );
};
