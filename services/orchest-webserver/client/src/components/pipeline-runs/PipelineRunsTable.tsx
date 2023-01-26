import { PipelineRun } from "@/types";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import React from "react";
import { PipelineRunRow } from "./PipelineRunRow";

export type JobRunsTableProps = {
  runs: PipelineRun[];
  expandable?: boolean;
  breadcrumbs?: boolean;
  viewLink?: boolean;
};

export const PipelineRunsTable = ({ runs, ...rowProps }: JobRunsTableProps) => {
  return (
    <TableContainer>
      <Table>
        <TableBody>
          {runs.map((run) => (
            <PipelineRunRow {...rowProps} key={run.uuid} run={run} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
