import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { Json, StrategyJson } from "@/types";
import { getHeight } from "@/utils/jquery-replacement";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
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
import { useIsEditingParameters } from "../stores/useIsEditingParameters";
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
    return parameterStrategy && Object.keys(parameterStrategy).length > 0
      ? generatePipelineRuns(parameterStrategy)
      : undefined;
  }, [parameterStrategy]);

  const pipelineRunRows = React.useMemo<DataTableRow<PipelineRunRow>[]>(() => {
    if (!pipelineJson?.name || !pipelineRuns) return [];
    return generatePipelineRunRows(pipelineRuns);
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
          return row.spec;
        },
      },
      {
        id: "toggle",
        label: "Include?",
        render: function IncludeToggle(row) {
          const isChecked = selectedRuns.some((run) => row.uuid === run);
          const disabled = selectedRuns.length === 1 && isChecked;
          const toggle = (
            <Switch
              checked={isChecked}
              disabled={disabled}
              onChange={(_, newCheckedValue) =>
                setSelectedRuns((current) => {
                  return newCheckedValue
                    ? [...current, row.uuid]
                    : current.filter((selected) => selected !== row.uuid);
                })
              }
              size="small"
              inputProps={{ "aria-label": "Include this run" }}
            />
          );

          return disabled ? (
            <Tooltip title="At least one run should be included.">
              <div>{toggle}</div>
            </Tooltip>
          ) : (
            toggle
          );
        },
      },
    ],
    [selectedRuns, setSelectedRuns]
  );

  const dataTableRef = React.useRef<HTMLDivElement | null>(null);

  const isEditingParameters = useIsEditingParameters(
    (state) => state.isEditingParameters
  );

  // To prevent jumping when editing parameters,fix the height of the table
  // and remove it when user is no focusing on any parameter fields.
  const dataTableContainerStyle = React.useMemo<
    React.CSSProperties | undefined
  >(() => {
    if (!isEditingParameters) return undefined;
    const fixedHeight = getHeight(dataTableRef.current);
    return {
      maxHeight: fixedHeight,
      minHeight: fixedHeight,
      overflowY: "auto",
    };
  }, [isEditingParameters]);

  return (
    <Stack
      direction="column"
      alignItems="flex-start"
      spacing={3}
      sx={{ paddingTop: (theme) => theme.spacing(4) }}
    >
      <EditJobSchedule />
      {hasValue(parameterStrategy) && pipelineRunRows.length > 0 && (
        <DataTable<PipelineRunRow, PipelineRunColumn>
          hideSearch
          id="job-edit-pipeline-runs"
          columns={columns}
          sx={{
            border: (theme) => `1px solid ${theme.borderColor}`,
            borderRadius: (theme) => theme.spacing(0.5),
            overflow: "hidden",
          }}
          style={dataTableContainerStyle}
          rows={pipelineRunRows}
          retainSelectionsOnPageChange
          data-test-id="job-edit-pipeline-runs"
          ref={dataTableRef}
        />
      )}
      <AutoCleanUpToggle selectedRuns={selectedRuns} />
    </Stack>
  );
};
