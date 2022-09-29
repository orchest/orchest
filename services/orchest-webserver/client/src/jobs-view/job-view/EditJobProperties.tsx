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

type EditJobPropertiesProps = { hideSelectPipeline?: true };

export const EditJobProperties = ({
  hideSelectPipeline = undefined,
}: EditJobPropertiesProps) => {
  return (
    <Accordion defaultExpanded>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Properties
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
