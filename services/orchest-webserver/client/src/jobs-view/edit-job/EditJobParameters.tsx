import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { LoadParametersDialog } from "@/edit-job-view/LoadParametersDialog";
import UploadIcon from "@mui/icons-material/Upload";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useLoadParameterStrategy } from "./hooks/useLoadParameterStrategy";
import { JobParameters } from "./JobParameters";
import { LoadParamFileDescription } from "./LoadParamFileDescription";

export const EditJobParameters = () => {
  const isReadOnly = useEditJob((state) => {
    const jobFinished =
      state.jobChanges?.status === "ABORTED" ||
      state.jobChanges?.status === "FAILURE" ||
      state.jobChanges?.status === "SUCCESS";

    const isDraft = state.jobChanges?.status === "DRAFT";
    const isActiveCronJob =
      !jobFinished && !isDraft && hasValue(state.jobChanges?.schedule);
    const isEditable = isDraft || isActiveCronJob;

    return !isEditable;
  });

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

  const { readParameterStrategyFile } = useLoadParameterStrategy();

  const closeDialogAndLoadParamsFromFile = (path: string) => {
    closeLoadParametersDialog();
    readParameterStrategyFile(path);
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        aria-controls="job-parameters"
        id="job-parameters-header"
      >
        <Typography component="h5" variant="h6">
          Parameters
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <JobParameters isReadOnly={isReadOnly} />
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ marginTop: 2, marginBottom: 2 }}
        >
          <Button
            color="primary"
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
      </AccordionDetails>
    </Accordion>
  );
};
