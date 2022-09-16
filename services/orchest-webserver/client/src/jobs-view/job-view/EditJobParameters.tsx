import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useHasChanged } from "@/hooks/useHasChanged";
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
  // When updating parameter values, `state.jobChanges.strategy_json` is also updated.
  // But we don't want to re-render the whole form when this happens.
  // Therefore, in `equals` function, check if existingStrategy is still empty.
  // Don't re-render if it already has properties.
  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);
  const hasValidPipeline = useEditJob((state) => state.hasValidPipeline);
  const hasChangedPipeline = useHasChanged(pipelineUuid);
  const initialStrategyJson = useEditJob(
    (state) => state.jobChanges?.strategy_json,
    (existingStrategy = {}) => {
      const existingStrategyKeys = Object.keys(existingStrategy);
      return existingStrategyKeys.length > 0 && !hasChangedPipeline;
    }
  );

  const { reservedKey } = useParameterReservedKey();
  const parameters = React.useMemo(() => {
    if (!initialStrategyJson || !reservedKey) return;
    const { [reservedKey]: pipelineParams, ...rest } = initialStrategyJson;
    return pipelineParams
      ? [pipelineParams, ...Object.values(rest)]
      : Object.values(rest);
  }, [initialStrategyJson, reservedKey]);

  const hasNoParameter = isReadOnly && parameters?.length === 0;
  const shouldRenderPipelineEditor = hasValue(parameters) && hasValidPipeline;

  return shouldRenderPipelineEditor ? (
    <>
      {hasNoParameter && (
        <Typography>
          <i>No Parameters have been defined.</i>
        </Typography>
      )}
      {parameters.map((parameter, index) => {
        if (!parameter) return null;
        const { key: strategyKey, parameters, title } = parameter;
        return (
          <Accordion
            defaultExpanded
            key={strategyKey}
            sx={{ marginLeft: (theme) => theme.spacing(3) }}
          >
            <AccordionSummary
              aria-controls="job-parameters"
              id="job-parameters-header"
            >
              <Typography variant="subtitle1">
                {index === 0 ? "Pipeline: " : "Step: "}
                {title || "(Unnamed step)"}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {Object.keys(parameters).map((parameterKey) => {
                return (
                  <JobParameterEditor
                    key={`${strategyKey}-${parameterKey}`}
                    isReadOnly={isReadOnly}
                    strategyKey={strategyKey}
                    parameterKey={parameterKey}
                  />
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </>
  ) : null;
};
