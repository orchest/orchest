import { useJobsApi } from "@/api/jobs/useJobsApi";
import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import { ParameterEditor } from "@/components/ParameterEditor";
import { LoadParametersDialog } from "@/edit-job-view/LoadParametersDialog";
import { StrategyJson } from "@/types";
import UploadIcon from "@mui/icons-material/Upload";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useGetJobData } from "../hooks/useGetJobData";
import { useEditJob } from "../stores/useEditJob";
import {
  JobAccordion,
  useJobParametersAccordion,
} from "./components/JobAccordion";
import { useLoadParameterStrategy } from "./hooks/useLoadParameterStrategy";
import { LoadParamFileDescription } from "./LoadParamFileDescription";

export const EditJobParameters = () => {
  const [isParametersOpen, setIsParametersOpen] = useJobParametersAccordion();

  const jobData = useGetJobData();
  const hasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );

  const pipelineFilePath = jobData?.pipeline_run_spec.run_config.pipeline_path;
  const parameterStrategy = useEditJob(
    (state) => state.jobChanges?.strategy_json
  );

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);
  const [
    isLoadParametersDialogOpen,
    setIsLoadParametersDialogOpen,
  ] = React.useState<boolean>(false);

  const showLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(true);
  };

  const closeLoadParametersDialog = () => {
    setIsLoadParametersDialogOpen(false);
  };

  const { loadParameterStrategy } = useLoadParameterStrategy();

  const closeDialogAndLoadParamsFromFile = () => {
    closeLoadParametersDialog();
    loadParameterStrategy();
  };

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
    hasValue(hasLoadedParameterStrategyFile) && hasValue(pipelineFilePath);

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
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ marginTop: 2, marginBottom: 2 }}
        >
          <Button
            color="secondary"
            onClick={showLoadParametersDialog}
            startIcon={<UploadIcon />}
          >
            Load parameter file
          </Button>
          <LoadParamFileDescription />
        </Stack>
        {pipelineUuid && (
          <LoadParametersDialog
            isOpen={isLoadParametersDialogOpen}
            onClose={closeLoadParametersDialog}
            onSubmit={closeDialogAndLoadParamsFromFile}
            pipelineUuid={pipelineUuid}
          />
        )}
        {shouldRenderPipelineEditor && (
          <ParameterEditor
            pipelineFilePath={pipelineFilePath}
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
