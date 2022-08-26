import { useJobsApi } from "@/api/jobs/useJobsApi";
import Stack from "@mui/material/Stack";
import React from "react";
import { useSaveJobChanges } from "../hooks/useSaveJobChanges";
import { useUpdateStatusInJobChanges } from "../hooks/useUpdateStatusInJobChanges";
import { NoJob } from "./NoJob";

type EditJobContainerProps = {
  children: React.ReactNode;
};

export const EditJobContainer = ({ children }: EditJobContainerProps) => {
  // Gather all side effects here to ensure that they are triggered on mount,
  // and prevent unnecessary re-render on children.

  useSaveJobChanges();
  useUpdateStatusInJobChanges();

  const jobs = useJobsApi((state) => state.jobs);
  const hasNoJob = jobs?.length === 0;

  return hasNoJob ? (
    <NoJob />
  ) : (
    <Stack
      direction="column"
      spacing={3}
      sx={{ paddingBottom: (theme) => theme.spacing(6) }}
    >
      {children}
    </Stack>
  );
};
