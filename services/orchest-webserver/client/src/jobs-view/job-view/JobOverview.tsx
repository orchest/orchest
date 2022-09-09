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

type JobOverviewProps = { hideSelectPipeline?: true };

export const JobOverview = ({ hideSelectPipeline }: JobOverviewProps) => {
  const isEditing = useEditJob((state) => state.isEditing);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Overview
        </Typography>
      </AccordionSummary>
      {isEditing && (
        <AccordionDetails sx={{ padding: (theme) => theme.spacing(2, 0) }}>
          <EditJobName />
          {!hideSelectPipeline && <EditJobPipeline />}
          <EditJobConfig />
        </AccordionDetails>
      )}
    </Accordion>
  );
};
