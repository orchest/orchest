import { DataTable, DataTableColumn } from "@/components/DataTable";
import React from "react";
import { PARAMETERLESS_RUN } from "./common";

type PipelineRunRow = { uuid: string; spec: string };

const runSpecTableColumns: DataTableColumn<PipelineRunRow>[] = [
  {
    id: "spec",
    label: "Run specification",
    render: function RunSpec(row) {
      return row.spec === PARAMETERLESS_RUN ? <i>{row.spec}</i> : row.spec;
    },
  },
];

export const RunSpecTable = ({
  rows,
  isLoading,
}: {
  rows: PipelineRunRow[];
  isLoading: boolean;
}) => {
  return (
    <DataTable<PipelineRunRow>
      id="run-spec-list"
      dense
      columns={runSpecTableColumns}
      isLoading={isLoading}
      rows={rows}
    />
  );
};
