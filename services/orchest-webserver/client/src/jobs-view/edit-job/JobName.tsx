import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

export const JobName = () => {
  const { jobChanges } = useEditJob();

  const isNameEmpty = jobChanges?.name.trim().length === 0;

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
      {isNameEmpty ? "(Unnamed)" : jobChanges?.name}
    </Typography>
  );
};
