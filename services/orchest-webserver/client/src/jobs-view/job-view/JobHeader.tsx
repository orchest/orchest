import Stack from "@mui/material/Stack";
import React from "react";
import { JobMoreOptions } from "./JobMoreOptions";
import { JobName } from "./JobName";
import { JobPrimaryButtons } from "./JobPrimaryButtons";
import { JobStatusAlert } from "./JobStatusAlert";

export const JobHeader = () => {
  return (
    <Stack direction="column" spacing={3} paddingBottom={2}>
      <Stack direction="row" spacing={3} alignItems="center">
        <JobName />
        <JobPrimaryButtons />
        <JobMoreOptions />
      </Stack>
      <JobStatusAlert />
    </Stack>
  );
};
