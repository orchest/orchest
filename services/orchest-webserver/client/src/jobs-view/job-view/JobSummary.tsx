import RouteLink from "@/components/RouteLink";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { JobData } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { humanizeDate } from "../common";
import { useSnapshot } from "../hooks/useSnapshot";
import { useActiveJob } from "./hooks/useActiveJob";

export const JobSummary = () => {
  const { activeJob } = useActiveJob();
  return activeJob ? <JobSummaryComponent job={activeJob} /> : null;
};

type JobSummaryComponentProps = {
  job: JobData;
};

const JobSummaryComponent = ({ job }: JobSummaryComponentProps) => {
  const { snapshot } = useSnapshot(job.snapshot_uuid);
  const pipelineUrl = useRouteLink("jobRun", {
    pipelineUuid: job.pipeline_uuid,
    jobUuid: job.uuid,
    snapshotUuid: job.snapshot_uuid,
  });

  return (
    <Stack direction="row" justifyContent="space-between">
      <Field name="Schedule">{job.schedule ? "Recurring" : "Run once"}</Field>
      <Field name="Pipeline">
        <RouteLink underline="none" to={pipelineUrl}>
          {job.pipeline_name}
        </RouteLink>
      </Field>
      <Field name="Scheduled for">
        {job.next_scheduled_time ? humanizeDate(job.next_scheduled_time) : "—"}
      </Field>
      <Field name="Snapshot date">
        {snapshot ? humanizeDate(snapshot.timestamp) : "—"}
      </Field>
    </Stack>
  );
};

const Field: React.FC<{ name: string }> = ({ name, children }) => (
  <Box>
    <Typography
      color="text.secondary"
      variant="subtitle2"
      paddingBottom={(theme) => theme.spacing(0.5)}
    >
      {name}
    </Typography>
    {children}
  </Box>
);
