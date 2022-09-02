import { ellipsis } from "@/utils/styles";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

export const JobName = () => {
  const name = useEditJob((state) => state.jobChanges?.name || "");

  return (
    <Typography variant="h4" flex={1} sx={ellipsis()}>
      {name}
    </Typography>
  );
};
