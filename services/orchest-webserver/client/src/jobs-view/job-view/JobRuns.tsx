import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useDebounce } from "@/hooks/useDebounce";
import { JobData } from "@/types";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Typography from "@mui/material/Typography";
import React from "react";
import { useActiveJob } from "./hooks/useActiveJob";
import { useJobRunsPage } from "./hooks/useJobRunsPage";
import { usePollPageJobRuns } from "./hooks/usePollJobRuns";
import { JobRunsTable } from "./JobRunsTable";

export const JobRuns = () => {
  const { activeJob } = useActiveJob();
  return activeJob ? <JobRunsCore job={activeJob} /> : null;
};

type JobRunsCoreProps = { job: JobData };

const JobRunsCore = ({ job }: JobRunsCoreProps) => {
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [fuzzyFilter, setFuzzyFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const { page, refresh } = useJobRunsPage({
    page: pageNumber,
    pageSize,
    fuzzyFilter: fuzzyFilter || undefined,
  });
  usePollPageJobRuns(refresh);
  const pageNumberRef = React.useRef(pageNumber);
  pageNumberRef.current = pageNumber;

  const debouncedSearch = useDebounce(search, 250);

  React.useEffect(() => {
    if (pageNumberRef.current === 1) refresh();
  }, [job.status, refresh]);

  React.useEffect(() => {
    setFuzzyFilter((current) => {
      if (current !== debouncedSearch) {
        setPageNumber(1);
      }
      return debouncedSearch;
    });
  }, [debouncedSearch]);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary>
        <Typography component="h5" variant="h6">
          Job Runs {page && <Chip label={page.pagination_data.total_items} />}
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
        {page && (
          <JobRunsTable
            runs={page.pipeline_runs}
            pageSize={pageSize}
            setPageSize={setPageSize}
            pageNumber={pageNumber}
            setPageNumber={setPageNumber}
            totalCount={page.pagination_data.total_items}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
};
