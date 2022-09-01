import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useGlobalContext } from "@/contexts/GlobalContext";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { JobParameterEditor } from "./JobParameterEditor";

type JobParametersProps = {
  isReadOnly: boolean | undefined;
};

export const JobParameters = ({ isReadOnly }: JobParametersProps) => {
  // When updating parameter values, `state.jobChanges.strategy_json` is also updated.
  // But we don't want to re-render the whole form when this happens.
  // Therefore, in `equals` function, check if existingStrategy is still empty.
  // Don't re-render if it already has properties.
  const initialStrategyJson = useEditJob(
    (state) => state.jobChanges?.strategy_json,
    (existingStrategy = {}) => {
      const existingStrategyKeys = Object.keys(existingStrategy);
      return existingStrategyKeys.length > 0;
    }
  );

  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY || "";
  const parameters = React.useMemo(() => {
    if (!initialStrategyJson || !reservedKey) return;
    const { [reservedKey]: pipelineParams, ...rest } = initialStrategyJson;
    return [pipelineParams, ...Object.values(rest)];
  }, [initialStrategyJson, reservedKey]);

  const shouldRenderPipelineEditor = hasValue(parameters);

  return shouldRenderPipelineEditor ? (
    <>
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
