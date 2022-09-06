import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import { EditJobEnvVariables } from "./EditJobEnvVariables";

export const JobEnvVariables = () => {
  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        aria-controls="job-env-variables"
        id="job-env-variables-header"
      >
        <Typography component="h5" variant="h6">
          Environment Variables
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <EditJobEnvVariables />
      </AccordionDetails>
    </Accordion>
  );
};
