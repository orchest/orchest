import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { EditJobConfig } from "./EditJobConfig";
import { EditJobName } from "./EditJobName";
import { EditJobPipeline } from "./EditJobPipeline";

export const JobOverview = () => {
  const isEditing = useEditJob((state) => state.isEditing);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Overview
        </Typography>
      </AccordionSummary>
      {isEditing && (
        <AccordionDetails sx={{ paddingTop: (theme) => theme.spacing(2) }}>
          <EditJobName />
          <EditJobPipeline />
          <EditJobConfig />
        </AccordionDetails>
      )}
    </Accordion>
  );
};
