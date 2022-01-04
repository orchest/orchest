import { NoParameterAlert } from "@/components/ParamTree";
import type { Json } from "@/types";
import { StrategyJson } from "@/types";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

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

export type PipelineRunRow = {
  uuid: string;
  spec: string;
  details: React.ReactNode;
};

export function generatePipelineRunRows(
  pipelineName: string,
  pipelineRuns: Record<string, Json>[]
): PipelineRunRow[] {
  return pipelineRuns.map((params: Record<string, Json>, index: number) => {
    const pipelineRunSpec = Object.entries(params).map(([fullParam, value]) => {
      // pipeline_parameters#something#another_something: "some-value"
      let paramName = fullParam.split("#").slice(1).join("");
      return `${paramName}: ${JSON.stringify(value)}`;
    });

    return {
      uuid: index.toString(),
      spec: pipelineRunSpec.join(", ") || "Parameterless run",
      details: (
        <Stack
          direction="column"
          alignItems="flex-start"
          sx={{ padding: (theme) => theme.spacing(2, 1) }}
        >
          {pipelineRunSpec.length === 0 ? (
            <NoParameterAlert />
          ) : (
            <>
              <Typography variant="body2">{pipelineName}</Typography>
              {pipelineRunSpec.map((param, index) => (
                <Typography
                  variant="caption"
                  key={index}
                  sx={{ paddingLeft: (theme) => theme.spacing(1) }}
                >
                  {param}
                </Typography>
              ))}
            </>
          )}
        </Stack>
      ),
    };
  });
}
