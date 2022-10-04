import { EmptyState } from "@/components/common/EmptyState";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Button from "@mui/material/Button";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { useCreateJob } from "../hooks/useCreateJob";

export const NoJob = (props: StackProps) => {
  const { createJob, canCreateJob } = useCreateJob();

  return (
    <Stack justifyContent="center" alignItems="center" sx={{ height: "100%" }}>
      <EmptyState
        imgSrc="/image/no-job.svg"
        title="No Jobs"
        description={`Jobs are a way to schedule one-off or recurring Pipelines runs. Jobs can run multiple iterations of the same Pipeline; taking different parameters as inputs.`}
        docPath="/fundamentals/jobs.html"
        actions={
          <Button
            variant="contained"
            disabled={!canCreateJob}
            onClick={createJob}
            startIcon={<AddOutlined />}
          >
            New Job
          </Button>
        }
        {...props}
      />
    </Stack>
  );
};
