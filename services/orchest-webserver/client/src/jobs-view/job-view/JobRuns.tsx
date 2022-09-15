import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useDebounce } from "@/hooks/useDebounce";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobRunsPage } from "./hooks/useJobRunsPage";
import { useJobRunsPolling } from "./hooks/useJobRunsPolling";
import { JobRunsTable } from "./JobRunsTable";

export const JobRuns = () => {
  const jobStatus = useEditJob((state) => state.jobChanges?.status);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [fuzzyFilter, setFuzzyFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [hasExpandedRow, setHasExpandedRow] = React.useState(false);
  const { runs, pagination, refresh } = useJobRunsPage({
    page: pageNumber,
    pageSize,
    fuzzyFilter: fuzzyFilter || undefined,
  });

  useJobRunsPolling(refresh, { disabled: hasExpandedRow });
  const pageNumberRef = React.useRef(pageNumber);
  pageNumberRef.current = pageNumber;

  const debouncedSearch = useDebounce(search, 250);

  React.useEffect(() => {
    if (pageNumberRef.current === 1) refresh();
  }, [jobStatus, refresh]);

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
          <JobRunsTable
            runs={runs}
            pageSize={pageSize}
            setPageSize={setPageSize}
            pageNumber={pageNumber}
            setPageNumber={setPageNumber}
            onLineToggled={(openCount) => setHasExpandedRow(openCount > 0)}
            totalCount={pagination.total_items}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
};
