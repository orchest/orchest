import { useJobsApi } from "@/api/jobs/useJobsApi";
import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import { ParameterEditor } from "@/components/ParameterEditor";
import { StrategyJson } from "@/types";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { useGetJobData } from "../hooks/useGetJobData";
import { useEditJob } from "../stores/useEditJob";
import {
  JobAccordion,
  useJobParametersAccordion,
} from "./components/JobAccordion";

export const EditJobParameters = () => {
  const [isParametersOpen, setIsParametersOpen] = useJobParametersAccordion();

  const jobData = useGetJobData();
  const hasLoadedParameterStrategy = useJobsApi(
    (state) => state.hasLoadedParameterStrategy
  );

  const pipelineName = useEditJob((state) => state.jobChanges?.name);
  const parameterStrategy = useEditJob(
    (state) => state.jobChanges?.strategy_json
  );

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const parameters = useEditJob((state) => state.jobChanges?.parameters);

  const handleChangeParameterStrategy = React.useCallback(
    (value: StrategyJson) => {
      if (!jobData?.uuid) return;
      // Note that useAutoSaveJob uses shallow compare.
      // Re-create the object in order to trigger auto-saving.
      setJobChanges({ strategy_json: { ...value } });
    },
    [jobData?.uuid, setJobChanges]
  );

  const handleChangeIsOpen = (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setIsParametersOpen(isExpanded);
  };

  const shouldRenderPipelineEditor =
    hasLoadedParameterStrategy && hasValue(pipelineName);

  return (
    <JobAccordion expanded={isParametersOpen} onChange={handleChangeIsOpen}>
      <AccordionSummary
        aria-controls="job-parameters"
        id="job-parameters-header"
      >
        <Typography component="h5" variant="h6">
          Parameters
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {shouldRenderPipelineEditor && (
          <ParameterEditor
            pipelineName={pipelineName}
            strategyJson={parameterStrategy}
            onParameterChange={(value: StrategyJson) => {
              handleChangeParameterStrategy(value);
            }}
            disableAutofocusCodeMirror
          />
        )}
      </AccordionDetails>
    </JobAccordion>
  );
};
