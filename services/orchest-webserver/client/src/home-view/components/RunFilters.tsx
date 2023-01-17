import { PipelineMetaData, Project } from "@/types";
import { omit } from "@/utils/record";
import { SystemStatus } from "@/utils/system-status";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React from "react";
import {
  DEFAULT_FILTER,
  isEmptyFilter,
  RunFilterState,
  RunMaxAxe,
  RunSortDirection,
} from "../utils/filter";
import { MaxAgeFilter } from "./MaxAgeFilter";
import { PipelineFilter } from "./PipelineFilter";
import { ProjectFilter } from "./ProjectFilter";
import { RunStatusFilter } from "./RunStatusFilter";
import { SortFilter } from "./SortFilter";

export type RunFiltersProps = {
  onChange: (state: RunFilterState) => void;
};

export const RunFilters = ({ onChange }: RunFiltersProps) => {
  const [filter, setFilter] = React.useState<RunFilterState>(DEFAULT_FILTER);

  const updateFilter = (patch: Partial<RunFilterState>) => {
    const newFilter = { ...filter, ...patch };

    setFilter(newFilter);
    onChange(newFilter);
  };

  const setMaxAge = (maxAge: RunMaxAxe) => updateFilter({ maxAge });
  const setSort = (sort: RunSortDirection) => updateFilter({ sort });
  const setProjects = (projects: Project[]) => updateFilter({ projects });
  const setStatuses = (statuses: SystemStatus[]) => updateFilter({ statuses });
  const setPipelines = (pipelines: PipelineMetaData[]) =>
    updateFilter({ pipelines });
  const clear = () => updateFilter(omit(DEFAULT_FILTER, "sort"));

  return (
    <Stack direction="row" justifyContent="space-between">
      <Stack direction="row" spacing={1}>
        <MaxAgeFilter selected={filter.maxAge} onChange={setMaxAge} />
        <RunStatusFilter selected={filter.statuses} onChange={setStatuses} />
        <ProjectFilter selected={filter.projects} onChange={setProjects} />
        <PipelineFilter selected={filter.pipelines} onChange={setPipelines} />
        <Button
          size="small"
          variant="text"
          disabled={isEmptyFilter(filter)}
          onClick={clear}
        >
          Clear filters
        </Button>
      </Stack>

      <Stack direction="row" spacing={1}>
        <SortFilter selected={filter.sort} onChange={setSort} />
      </Stack>
    </Stack>
  );
};
