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

export const JobOverview = () => {
  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Overview
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ paddingTop: (theme) => theme.spacing(2) }}>
        <EditJobName />
        <EditJobPipeline />
        <EditJobConfig />
      </AccordionDetails>
    </Accordion>
  );
};
