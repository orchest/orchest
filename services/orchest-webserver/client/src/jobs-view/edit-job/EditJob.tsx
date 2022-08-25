import Stack from "@mui/material/Stack";
import React from "react";
import { useUpdateJobOnUnmount } from "../hooks/useUpdateJobOnUnmount";
import { EditJobContainer } from "./EditJobContainer";
import { JobMoreOptions } from "./JobMoreOptions";
import { JobName } from "./JobName";
import { JobOverview } from "./JobOverview";
import { JobPrimaryButton } from "./JobPrimaryButton";

export const EditJob = () => {
  useUpdateJobOnUnmount();
  return (
    <EditJobContainer>
      <Stack
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: (theme) => theme.palette.background.paper,
          zIndex: 2,
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
      <JobOverview />
      {/* 
      <EnvironmentSetupScript />
      <EnvironmentImageBuildLogs /> */}
    </EditJobContainer>
  );
};
