import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { EditJobEnvVariables } from "./EditJobEnvVariables";

export const JobEnvVariables = () => {
  const isReadOnly = useEditJob((state) => !state.isEditing);

  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    setExpanded(!isReadOnly);
  }, [isReadOnly]);

  return (
    <Accordion expanded={expanded}>
      <AccordionSummary
        aria-controls="job-env-variables"
        id="job-env-variables-header"
        onClick={() => setExpanded((value) => !value)}
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
