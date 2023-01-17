import { DataTableRow } from "@/components/DataTable";
import {
  JobChanges,
  JobChangesData,
  JobData,
  Json,
  PipelineRun,
  PipelineRunStatus,
  StrategyJson,
} from "@/types";
import { pick } from "@/utils/record";
import capitalize from "@mui/utils/capitalize";
import React from "react";

export const pickJobChangesData = (
  jobData?: JobData
): JobChangesData | undefined => {
  if (!jobData) return undefined;

  return pick(
    jobData,
    "uuid",
    "name",
    "parameters",
    "env_variables",
    "strategy_json",
    "max_retained_pipeline_runs",
    "schedule",
    "next_scheduled_time"
  );
};

export const pickJobChanges = (jobData?: JobData): JobChanges | undefined => {
  if (!jobData) return undefined;

  const selectedProperties = pick(
    jobData,
    "uuid",
    "name",
    "parameters",
    "strategy_json",
    "env_variables",
    "max_retained_pipeline_runs",
    "schedule",
    "status",
    "project_uuid",
    "pipeline_uuid",
    "next_scheduled_time",
    "snapshot_uuid",
    "pipeline_definition"
  );

  return {
    ...selectedProperties,
    pipeline_path: jobData.pipeline_run_spec.run_config.pipeline_path,
  };
};

export const formatPipelineParams = (parameters: Record<string, Json>) => {
  return Object.values(parameters).map((parameter) => {
    return parameter === null
      ? "null"
      : Object.entries(parameter)
          .map(([key, value]) => {
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join(", ");
  });
};

export type PipelineRunRow = {
  uuid: string;
  spec: string;
};

export type PipelineRunColumn = PipelineRunRow & {
  toggle: React.ReactNode;
};

type ParamValue = number | string | boolean;

// strategy could be a pipeline step, or pipeline setting
// see editJobView.mock.ts for example
export function flattenStrategyJson(
  strategyJSON: StrategyJson
): Record<string, ParamValue[]> {
  return Object.entries(strategyJSON).reduce(
    (all, [strategyKey, strategyValue]) => {
      const flattened = {};
      Object.entries(strategyValue.parameters).forEach(([paramKey, value]) => {
        // create a new key with strategy key and param key
        const fullParam = `${strategyKey}#${paramKey}`;
        // parse the string, it will be an array of parameter values
        flattened[fullParam] = JSON.parse(value);
      });
      return { ...all, ...flattened };
    },
    {}
  );
}

export function generatePipelineRunParamCombinations(
  params: Record<string, ParamValue[]>,
  accum: (Record<string, ParamValue> | Record<string, ParamValue[]>)[],
  unpacked: string[]
) {
  // deep clone
  unpacked = [...unpacked];
  accum = [...accum];

  for (const fullParam in params) {
    if (!unpacked.includes(fullParam)) {
      unpacked.push(fullParam);
      const valueArr = params[fullParam];
      if (!Array.isArray(valueArr)) continue;
      valueArr.forEach((value) => {
        let localParams = JSON.parse(JSON.stringify(params));
        // collapse param list to paramValue
        localParams[fullParam] = value;
        accum = generatePipelineRunParamCombinations(
          localParams,
          accum,
          unpacked
        );
      });

      return accum;
    }
  }

  return [...accum, params];
}

export function generatePipelineRunRows(
  pipelineRuns: Record<string, Json>[]
): DataTableRow<PipelineRunRow>[] {
  return pipelineRuns.map((params: Record<string, Json>, index: number) => {
    const pipelineRunSpec = Object.entries(params).map(([fullParam, value]) => {
      // pipeline_parameters#something#another_something: "some-value"
      let paramName = fullParam.split("#").slice(1).join("");
      return `${paramName}: ${JSON.stringify(value)}`;
    });
    const spec = pipelineRunSpec.join(", ").trim();

    return {
      id: index.toString(),
      uuid: index.toString(),
      spec: spec || "—",
    };
  });
}

export const generateJobParameters = (
  generatedPipelineRuns: { [stepUuid: string]: Json }[],
  selectedIndices: string[]
) => {
  return selectedIndices.map((index) => {
    const runParameters = generatedPipelineRuns[index] || {};
    return Object.entries(runParameters).reduce((all, [key, value]) => {
      // key is formatted: <stepUUID>#<parameterKey>
      const keySplit = key.split("#");
      const stepUUID = keySplit[0];
      const parameterKey = keySplit.slice(1).join("#");

      // check if step already exists,
      const parameter = all[stepUUID] || {};
      parameter[parameterKey] = value;

      return { ...all, [stepUUID]: parameter };
    }, {});
  });
};

export const formatRunStatus = (status: PipelineRunStatus) => {
  switch (status) {
    case "ABORTED":
      return "Canceled";
    default:
      return capitalize(status.toLowerCase());
  }
};

export const canCancelRun = (
  run: PipelineRun | undefined
): run is PipelineRun => run?.status === "STARTED" || run?.status === "PENDING";
