import { SystemStatusChip } from "@/components/common/SystemStatusChip";
import { PipelineRunStatus } from "@/types";
import { statusTitle } from "@/utils/system-status";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { MultiFilter } from "./MultiFilter";

const statuses: readonly PipelineRunStatus[] = [
  "STARTED",
  "PENDING",
  "SUCCESS",
  "FAILURE",
  "ABORTED",
];

export type RunStatusFilterProps = {
  selected: PipelineRunStatus[];
  onChange: (statuses: PipelineRunStatus[]) => void;
};

export const RunStatusFilter = ({
  selected,
  onChange,
}: RunStatusFilterProps) => {
  return (
    <MultiFilter
      label="Status"
      id="status"
      minWidth="90px"
      selected={selected}
      onChange={(values) => onChange(values)}
      prettify={(status) => statusTitle(status, "pipeline")}
    >
      {statuses.map((status) => (
        <MenuItem dense key={status} value={status}>
          <Checkbox checked={selected.includes(status)} />
          <SystemStatusChip
            status={status}
            flavor="pipeline"
            size="small"
            animate={false}
          />
        </MenuItem>
      ))}
    </MultiFilter>
  );
};
