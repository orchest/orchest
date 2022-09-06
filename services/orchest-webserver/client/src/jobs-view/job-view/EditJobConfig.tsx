import { DataTable, DataTableColumn } from "@/components/DataTable";
import { Json, StrategyJson } from "@/types";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import {
  flattenStrategyJson,
  generatePipelineRunParamCombinations,
  generatePipelineRunRows,
  PipelineRunColumn,
  PipelineRunRow,
} from "../common";
import { useEditJob } from "../stores/useEditJob";
import { AutoCleanUpToggle } from "./AutoCleanUpToggle";
import { EditJobSchedule } from "./EditJobSchedule";
import { useIsEditingActiveCronJob } from "./hooks/useIsEditingActiveCronJob";
import { useSelectedRuns } from "./hooks/useSelectedRuns";

const generatePipelineRuns = (strategyJSON: StrategyJson) => {
  const flatParameters = flattenStrategyJson(strategyJSON);
  const pipelineRuns: Record<
    string,
    Json
  >[] = generatePipelineRunParamCombinations(flatParameters, [], []);

  return pipelineRuns;
};

export const EditJobConfig = () => {
  const pipelineJson = useEditJob(
    (state) => state.jobChanges?.pipeline_definition
  );

  const { isEditingActiveCronJob } = useIsEditingActiveCronJob();

  const parameterStrategy = useEditJob((state) =>
    isEditingActiveCronJob
      ? state.cronJobChanges?.strategy_json
      : state.jobChanges?.strategy_json
  );

  const pipelineRuns = React.useMemo(() => {
    return parameterStrategy
      ? generatePipelineRuns(parameterStrategy)
      : undefined;
  }, [parameterStrategy]);

  const pipelineRunRows = React.useMemo(() => {
    if (!pipelineJson?.name || !pipelineRuns) return [];
    return generatePipelineRunRows(pipelineJson.name, pipelineRuns);
  }, [pipelineRuns, pipelineJson?.name]);

  const [selectedRuns, setSelectedRuns] = useSelectedRuns(
    pipelineRuns,
    pipelineRunRows
  );

  const columns: DataTableColumn<
    PipelineRunRow,
    PipelineRunColumn
  >[] = React.useMemo(
    () => [
      {
        id: "spec",
        label: "Pipeline runs",
        render: function Params(row) {
          return row.spec === "Parameterless run" ? (
            <i>{row.spec}</i>
          ) : (
            row.spec
          );
        },
      },
      {
        id: "toggle",
        label: "Include?",
        render: function IncludeToggle(row) {
          return (
            <Switch
              checked={selectedRuns.some((run) => row.uuid === run)}
              onChange={(_, checked) =>
                setSelectedRuns((current) =>
                  checked
                    ? [...current, row.uuid]
                    : current.filter((selected) => selected !== row.uuid)
                )
              }
              size="small"
              inputProps={{ "aria-label": "Include this run" }}
            />
          );
        },
      },
    ],
    [selectedRuns, setSelectedRuns]
  );

  return (
    <Stack
      direction="column"
      alignItems="flex-start"
      spacing={3}
      sx={{ paddingTop: (theme) => theme.spacing(4) }}
    >
      <EditJobSchedule />
      {hasValue(parameterStrategy) && (
        <DataTable<PipelineRunRow, PipelineRunColumn>
          hideSearch
          id="job-edit-pipeline-runs"
          columns={columns}
          sx={{
            border: (theme) => `1px solid ${theme.borderColor}`,
            borderRadius: (theme) => theme.spacing(0.5),
            overflow: "hidden",
          }}
          rows={pipelineRunRows}
          retainSelectionsOnPageChange
          data-test-id="job-edit-pipeline-runs"
        />
      )}
      <AutoCleanUpToggle selectedRuns={selectedRuns} />
    </Stack>
  );
};
