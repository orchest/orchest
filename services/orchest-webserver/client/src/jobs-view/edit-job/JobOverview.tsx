import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import { JobAccordion, useJobAccordions } from "./components/JobAccordion";
import { EditJobName } from "./EditJobName";
import { EditJobPipeline } from "./EditJobPipeline";

export const JobOverview = () => {
  const { isOverviewOpen, setIsOverviewOpen } = useJobAccordions();

  const handleChangeIsOpen = (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setIsOverviewOpen(isExpanded);
  };

  return (
    <JobAccordion expanded={isOverviewOpen} onChange={handleChangeIsOpen}>
      <AccordionSummary aria-controls="job-overview" id="job-overview-header">
        <Typography component="h5" variant="h6">
          Overview
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          paddingTop: (theme) => theme.spacing(2),
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <EditJobName />
        <EditJobPipeline />
      </AccordionDetails>
    </JobAccordion>
  );
};
