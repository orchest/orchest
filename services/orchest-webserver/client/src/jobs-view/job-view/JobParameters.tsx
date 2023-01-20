import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useToggle } from "@/hooks/useToggle";
import { LoadParametersDialog } from "@/jobs-view/job-view/LoadParametersDialog";
import UploadIcon from "@mui/icons-material/Upload";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { EditJobParameters } from "./EditJobParameters";
import { useLoadParameterStrategy } from "./hooks/useLoadParameterStrategy";
import { LoadParamFileDescription } from "./LoadParamFileDescription";

export const JobParameters = () => {
  const isReadOnly = useEditJob((state) => !state.isEditing);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    setExpanded(!isReadOnly);
  }, [isReadOnly]);
  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);

  const [isLoadParametersDialogOpen, toggleLoadParametersDialog] = useToggle();

  const showLoadParametersDialog = () => {
    toggleLoadParametersDialog(true);
  };

  const closeLoadParametersDialog = () => {
    toggleLoadParametersDialog(false);
  };

  const { readParameterStrategyFile } = useLoadParameterStrategy();

  const closeDialogAndLoadParamsFromFile = (path: string) => {
    closeLoadParametersDialog();
    readParameterStrategyFile(path);
  };

  return (
    <Accordion expanded={expanded}>
      <AccordionSummary
        aria-controls="job-parameters"
        id="job-parameters-header"
        onClick={() => setExpanded((value) => !value)}
      >
        <Typography component="h5" variant="h6">
          Parameters
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <EditJobParameters isReadOnly={isReadOnly} />
        {!isReadOnly && (
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
        )}
        {pipelineUuid && !isReadOnly && (
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
