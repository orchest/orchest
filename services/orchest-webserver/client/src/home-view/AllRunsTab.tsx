import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { PipelineRunsTable } from "@/components/pipeline-runs/PipelineRunsTable";
import { useFetchJobs } from "@/hooks/useFetchJobs";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { usePollRunningPipelineRuns } from "@/hooks/usePollRunningPipelineRuns";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { RunFilters } from "./components/RunFilters";
import { DEFAULT_FILTER, filterRuns, RunFilterState } from "./utils/filter";

export const AllRunsTab = () => {
  useFetchJobs();
  useFetchPipelines();

  const [filter, setFilter] = React.useState<RunFilterState>(DEFAULT_FILTER);
  const interactiveRuns = usePollRunningPipelineRuns();

  return (
    <Stack spacing={2}>
      <RunFilters onChange={setFilter} />

      <Accordion>
        <AccordionSummary>
          <Typography color="text.secondary" variant="subtitle1">
            Interactive runs
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <PipelineRunsTable
            breadcrumbs
            runs={filterRuns(interactiveRuns, filter)}
          />
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
