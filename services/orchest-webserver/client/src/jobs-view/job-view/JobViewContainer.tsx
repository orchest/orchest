import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useScopeParameters } from "@/hooks/useScopeParameters";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useSaveJobChanges } from "../hooks/useSaveJobChanges";
import { useUpdateStatusInJobChanges } from "../hooks/useUpdateStatusInJobChanges";
import { NoJob } from "./NoJob";

type JobViewContainerProps = {
  children: React.ReactNode;
};

export const JobViewContainer = ({ children }: JobViewContainerProps) => {
  // Gather all side effects here to ensure that they are triggered on mount,
  // and prevent unnecessary re-render on children.

  useSaveJobChanges();
  useUpdateStatusInJobChanges();

  const { jobUuid } = useScopeParameters();
  const jobs = useJobsApi((state) => state.jobs);
  const isLoading = Boolean(!jobs);
  const hasNoJobs = !isLoading && jobs?.length;

  if (isLoading) {
    return null;
  } else if (!hasNoJobs) {
    return <NoJob />;
  } else {
    return (
      <Stack
        direction="column"
        spacing={3}
        sx={{ paddingBottom: (theme) => theme.spacing(6) }}
      >
        {hasValue(jobUuid) ? children : null}
      </Stack>
    );
  }
};
