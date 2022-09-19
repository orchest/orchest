import { ViewportCenterMessage } from "@/pipeline-view/pipeline-viewport/components/ViewportCenterMessage";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";

export const NoJob = (props: StackProps) => {
  return (
    <Stack justifyContent="center" alignItems="center" sx={{ height: "100%" }}>
      <ViewportCenterMessage
        imgSrc="/image/no-job.svg"
        title="No Jobs"
        description={`Jobs are a way to schedule one-off or recurring Pipelines runs. Jobs can run multiple iterations of the same Pipeline; taking different parameters as inputs.`}
        docPath="https://docs.orchest.io/en/stable/fundamentals/jobs.html"
        {...props}
      />
    </Stack>
  );
};
