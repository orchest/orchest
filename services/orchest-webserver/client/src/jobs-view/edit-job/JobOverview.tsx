import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import Typography from "@mui/material/Typography";
import React from "react";
import {
  JobAccordion,
  useJobOverviewAccordion,
} from "./components/JobAccordion";
import { EditJobName } from "./EditJobName";
import { EditJobPipeline } from "./EditJobPipeline";
import { JobRunConfig } from "./JobRunConfig";

export const JobOverview = () => {
  const [isOverviewOpen, setIsOverviewOpen] = useJobOverviewAccordion();

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
      <AccordionDetails sx={{ paddingTop: (theme) => theme.spacing(2) }}>
        <EditJobName />
        <EditJobPipeline />
        <JobRunConfig />
      </AccordionDetails>
    </JobAccordion>
  );
};
