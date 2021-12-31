import { DataTable, DataTableColumn } from "@/components/DataTable";
import React from "react";
import { PARAMETERLESS_RUN } from "./commons";

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

export const RunSpecTable = ({ rows }: { rows: PipelineRunRow[] }) => {
  return (
    <DataTable<PipelineRunRow>
      id="run-spec-list"
      columns={runSpecTableColumns}
      rows={rows}
    />
  );
};
