import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { PipelineRunsTable } from "@/components/pipeline-runs/PipelineRunsTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchJobRunsPage } from "@/hooks/useFetchJobRunsPage";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import TablePagination from "@mui/material/TablePagination";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { usePollPageJobRuns } from "./hooks/usePollJobRuns";

export const JobRuns = () => {
  const jobStatus = useEditJob((state) => state.jobChanges?.status);
  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [fuzzyFilter, setFuzzyFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const query: JobRunsPageQuery = React.useMemo(
    () => ({
      page: pageNumber,
      pageSize,
      jobUuids: jobUuid ? [jobUuid] : undefined,
      fuzzyFilter: fuzzyFilter || undefined,
    }),
    [pageNumber, pageSize, jobUuid, fuzzyFilter]
  );
  const { runs, pagination, reload } = useFetchJobRunsPage(query);

  usePollPageJobRuns(reload);

  const pageNumberRef = React.useRef(pageNumber);
  pageNumberRef.current = pageNumber;

  React.useEffect(() => {
    if (pageNumberRef.current === 1) reload();
  }, [jobStatus, reload]);

  const debouncedSearch = useDebounce(search, 250);

  React.useEffect(() => {
    setFuzzyFilter((current) => {
      if (current !== debouncedSearch) setPageNumber(1);
      return debouncedSearch;
    });
  }, [debouncedSearch]);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary>
        <Typography component="h5" variant="h6">
          Job Runs {pagination && <Chip label={pagination.total_items} />}
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Box padding={(theme) => theme.spacing(3, 0)}>
          <OutlinedInput
            fullWidth
            value={search}
            placeholder="Search pipeline runs"
            onChange={({ target }) => setSearch(target.value)}
            startAdornment={
              <SearchOutlined
                color="action"
                sx={{ margin: (theme) => theme.spacing(0, 1) }}
              />
            }
          />
        </Box>

        {pagination && runs && (
          <>
            <PipelineRunsTable runs={runs} expandable viewLink />
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={pagination.total_items}
              rowsPerPage={pageSize}
              page={pageNumber - 1}
              onPageChange={(_, newPage) => setPageNumber(newPage + 1)}
              onRowsPerPageChange={(event) =>
                setPageSize(Number(event.target.value))
              }
            />
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
