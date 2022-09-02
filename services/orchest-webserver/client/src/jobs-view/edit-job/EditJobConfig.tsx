import { DataTable, DataTableColumn } from "@/components/DataTable";
import { Json, StrategyJson } from "@/types";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import {
  flattenStrategyJson,
  generateJobParameters,
  generatePipelineRunParamCombinations,
  generatePipelineRunRows,
  PipelineRunColumn,
  PipelineRunRow,
} from "../common";
import { useEditJob } from "../stores/useEditJob";
import { AutoCleanUpToggle } from "./AutoCleanUpToggle";
import { EditJobSchedule } from "./EditJobSchedule";

const generatePipelineRuns = (strategyJSON: StrategyJson) => {
  const flatParameters = flattenStrategyJson(strategyJSON);
  const pipelineRuns: Record<
    string,
    Json
  >[] = generatePipelineRunParamCombinations(flatParameters, [], []);

  return pipelineRuns;
};

const findParameterization = (
  parameterization: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  parameters: Record<string, Json>[]
) => {
  let JSONstring = JSON.stringify(parameterization);
  for (let x = 0; x < parameters.length; x++) {
    if (JSON.stringify(parameters[x]) === JSONstring) {
      return x;
    }
  }
  return -1;
};

const parseParameters = (
  parameters: Record<string, Json>[],
  generatedPipelineRuns: Record<string, Json>[]
): string[] => {
  const _parameters = cloneDeep(parameters);
  const selectedIndices = new Set<string>();
  generatedPipelineRuns.forEach((run, index) => {
    const encodedParameterization = generateJobParameters([run], ["0"])[0];

    const needleIndex = findParameterization(
      encodedParameterization,
      _parameters
    );
    if (needleIndex >= 0) {
      selectedIndices.add(index.toString());
      // remove found parameterization from _parameters, as to not count duplicates
      _parameters.splice(needleIndex, 1);
    } else {
      selectedIndices.delete(index.toString());
    }
  });

  return Array.from(selectedIndices);
};

export const EditJobConfig = () => {
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);

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
    [selectedRuns]
  );

  const pipelineJson = useEditJob(
    (state) => state.jobChanges?.pipeline_definition
  );

  const parameterStrategy = useEditJob(
    (state) => state.jobChanges?.strategy_json
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

  const parameters = useEditJob((state) => state.jobChanges?.parameters);

  React.useLayoutEffect(() => {
    if (!parameters || !pipelineRuns) return;
    setSelectedRuns(
      parameters.length > 0
        ? parseParameters(parameters, pipelineRuns)
        : pipelineRunRows.map((row) => row.uuid)
    );
  }, [parameters, pipelineRunRows, pipelineRuns]);

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
