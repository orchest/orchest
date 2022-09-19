import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import { EditJobConfig } from "./EditJobConfig";
import { EditJobName } from "./EditJobName";
import { EditJobPipeline } from "./EditJobPipeline";

type JobOverviewProps = { hideSelectPipeline?: true };

export const EditJobOverview = ({
  hideSelectPipeline = undefined,
}: JobOverviewProps) => {
  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Overview
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ padding: (theme) => theme.spacing(2, 0) }}>
        <EditJobName />
        {!hideSelectPipeline && <EditJobPipeline />}
        <EditJobConfig />
      </AccordionDetails>
    </Accordion>
  );
};
