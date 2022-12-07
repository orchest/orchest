import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { StrategyJsonValue } from "@/types";
import { capitalize } from "@mui/material";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useParameterReservedKey } from "./hooks/useParameterReservedKey";
import { JobParameterEditor } from "./JobParameterEditor";

type EditJobParametersProps = {
  isReadOnly: boolean | undefined;
};

export const EditJobParameters = ({ isReadOnly }: EditJobParametersProps) => {
  const strategyJson = useEditJob((state) => state.jobChanges?.strategy_json);

  // Get the "pipeline_parameters" key.
  const { reservedKey } = useParameterReservedKey();

  const parameters = React.useMemo(() => {
    if (!strategyJson || !reservedKey) return undefined;

    const { [reservedKey]: pipelineParams, ...other } = strategyJson;

    return { pipeline: pipelineParams, steps: Object.values(other) };
  }, [strategyJson, reservedKey]);

  const shouldRenderPipelineEditor = hasValue(parameters);
  const hasNoParameter =
    isReadOnly &&
    !hasValue(parameters?.pipeline) &&
    parameters?.steps.length === 0;

  return shouldRenderPipelineEditor ? (
    <>
      {hasNoParameter && (
        <Typography>
          <i>No Parameters have been defined.</i>
        </Typography>
      )}
      {parameters.pipeline && (
        <ParameterEditor
          source="pipeline"
          parameter={parameters.pipeline}
          isReadOnly={isReadOnly}
        />
      )}
      {parameters.steps.map((parameter) => (
        <ParameterEditor
          source="step"
          key={parameter.key}
          parameter={parameter}
          isReadOnly={isReadOnly}
        />
      ))}
    </>
  ) : null;
};

const ParameterEditor = ({
  parameter,
  isReadOnly,
  source,
}: {
  parameter: StrategyJsonValue;
  isReadOnly?: boolean;
  source: "pipeline" | "step";
}) => {
  return (
    <Accordion defaultExpanded sx={{ marginLeft: (theme) => theme.spacing(3) }}>
      <AccordionSummary aria-controls="job-parameters">
        <Typography variant="subtitle1">
          {parameter.title
            ? capitalize(source) + ": " + parameter.title
            : "Unnamed " + source}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {Object.keys(parameter.parameters).map((parameterKey) => {
          return (
            <JobParameterEditor
              key={`${parameter.key}:${parameterKey}`}
              isReadOnly={isReadOnly}
              strategyKey={parameter.key}
              parameterKey={parameterKey}
            />
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};
