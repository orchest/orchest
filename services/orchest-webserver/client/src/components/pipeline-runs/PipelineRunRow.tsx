import { useToggle } from "@/hooks/useToggle";
import { formatPipelineParams, humanizeDate } from "@/jobs-view/common";
import { JobRun, PipelineRun } from "@/types";
import { isJobRun } from "@/utils/pipeline-run";
import { ChevronRightSharp } from "@mui/icons-material";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React from "react";
import { SystemStatusChip } from "../common/SystemStatusChip";

export type PipelineRunRowProps = {
  run: PipelineRun | JobRun;
  onToggle?: (isOpen: boolean) => void;
  onContextMenu?: (anchorEl: Element) => void;
};

export const PipelineRunRow = ({
  run,
  onContextMenu,
  onToggle,
}: PipelineRunRowProps) => {
  const [isExpanded, toggleRow] = useToggle();

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        {isJobRun(run) && (
          <TableCell sx={{ width: 0, padding: 0, margin: 0 }}>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => toggleRow()}
            >
              <ChevronRightSharp
                style={{
                  transform: isExpanded ? "rotate(90deg)" : undefined,
                  transition: "transform 150ms ease-in",
                }}
              />
            </IconButton>
          </TableCell>
        )}
        <TableCell sx={{ width: "100%" }}>
          {isJobRun(run) ? "#" + (run.job_run_index + 1) : "Interactive run"}{" "}
          <span>
            {formatPipelineParams(run.parameters ?? {})
              .join(", ")
              .trim()}
          </span>
        </TableCell>
        <TableCell sx={{ textAlign: "right" }}>
          <SystemStatusChip status={run.status} flavor="job" size="small" />
        </TableCell>

        <TableCell sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {run.started_time ? humanizeDate(run.started_time) : "—"}
        </TableCell>

        {onContextMenu && (
          <TableCell sx={{ textAlign: "right" }}>
            <IconButton
              onClick={({ currentTarget }) => onContextMenu?.(currentTarget)}
            >
              <MoreHorizOutlined fontSize="small" />
            </IconButton>
          </TableCell>
        )}
      </TableRow>

      {onToggle && (
        <TableRow>
          <TableCell sx={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
            <Collapse
              in={isExpanded}
              timeout="auto"
              onEnter={() => onToggle?.(true)}
              onExited={() => onToggle?.(false)}
              unmountOnExit
            >
              <RunDetails run={run} />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export type RunDetailsProps = { run: PipelineRun };

export const RunDetails = ({ run }: RunDetailsProps) => {
  const params = formatPipelineParams(run.parameters);
  const hasParameters = params.length > 0;

  return (
    <Stack
      sx={{ margin: (theme) => theme.spacing(1, 0) }}
      direction="column"
      justifyContent="flex-start"
    >
      {params.map((param, index) => (
        <Typography variant="caption" key={index}>
          {param}
        </Typography>
      ))}
      {!hasParameters && <NoParameterAlert />}
    </Stack>
  );
};

export const NoParameterAlert = () => (
  <Typography variant="body2">
    <i>{`This Pipeline didn't have any Parameters defined.`}</i>
  </Typography>
);
