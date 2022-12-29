import { PipelineRun } from "@/types";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import React from "react";
import { PipelineRunRow } from "./PipelineRunRow";

export type JobRunsTableProps = {
  runs: PipelineRun[];
  onLineToggled?: (openRows: number) => void;
};

type ContextMenuState = {
  isOpen?: boolean;
  run?: PipelineRun | undefined;
  anchorEl?: Element | undefined;
};

export const PipelineRunsTable = ({
  runs,
  onLineToggled,
}: JobRunsTableProps) => {
  const [expanded, setExpanded] = React.useState<number>(0);

  return (
    <TableContainer>
      <Table>
        <TableBody>
          {runs.map((run) => (
            <PipelineRunRow
              key={run.uuid}
              run={run}
              onToggle={(open) =>
                setExpanded((count) => count + (open ? 1 : -1))
              }
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
