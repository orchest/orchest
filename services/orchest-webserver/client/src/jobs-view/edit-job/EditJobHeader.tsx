import Stack from "@mui/material/Stack";
import React from "react";
import { JobMoreOptions } from "./JobMoreOptions";
import { JobName } from "./JobName";
import { JobPrimaryButton } from "./JobPrimaryButton";

export const EditJobHeader = () => {
  return (
    <Stack
      sx={{
        position: "sticky",
        top: 0,
        backgroundColor: (theme) => theme.palette.background.paper,
        zIndex: 3,
        paddingTop: (theme) => theme.spacing(5),
      }}
      direction="column"
      spacing={3}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <JobName />
        <JobPrimaryButton />
        <JobMoreOptions />
      </Stack>
      {/* <BuildStatusAlert /> */}
    </Stack>
  );
};
