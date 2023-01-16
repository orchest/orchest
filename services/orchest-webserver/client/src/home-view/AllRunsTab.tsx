import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { PipelineRunsTable } from "@/components/pipeline-runs/PipelineRunsTable";
import { useFetchJobs } from "@/hooks/useFetchJobs";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { usePollRunningPipelineRuns } from "@/hooks/usePollRunningPipelineRuns";
import { useJobRunsPage } from "@/jobs-view/job-view/hooks/useJobRunsPage";
import Pagination from "@mui/material/Pagination";
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
  const [page, setPage] = React.useState<number>(1);
  const { runs: jobRuns, pagination } = useJobRunsFromFilter(filter, page);

  return (
    <Stack spacing={2} minHeight={625} width="100%">
      <RunFilters onChange={setFilter} />

      {page === 1 && (
        <Accordion defaultExpanded={true}>
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
      )}

      <Accordion defaultExpanded={true}>
        <AccordionSummary>
          <Typography color="text.secondary" variant="subtitle1">
            Job runs
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <Stack minHeight="390px">
            <PipelineRunsTable breadcrumbs runs={jobRuns ?? []} />
          </Stack>

          <Stack alignItems="center" marginTop={2}>
            {pagination?.total_pages && (
              <Pagination
                color="primary"
                count={pagination.total_pages}
                page={page}
                onChange={(_, pageNumber) => setPage(pageNumber)}
              />
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

const useJobRunsFromFilter = (filter: RunFilterState, page: number) => {
  const query: JobRunsPageQuery = React.useMemo(
    () => ({
      page,
      pageSize: 5,
      projectUuids: filter.projects.length
        ? filter.projects.map((project) => project.uuid)
        : undefined,
      pipelines: filter.pipelines.length
        ? filter.pipelines.map((pipeline) => ({
            pipelineUuid: pipeline.uuid,
            projectUuid: pipeline.project_uuid,
          }))
        : undefined,
      statuses: filter.statuses.length ? filter.statuses : undefined,
    }),
    [filter.pipelines, filter.projects, filter.statuses, page]
  );

  return useJobRunsPage(query);
};
