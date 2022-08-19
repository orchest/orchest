import { EnvironmentImagesRadioGroup } from "@/environments-view/edit-environment/EnvironmentImagesRadioGroup";
import Typography from "@mui/material/Typography";
import React from "react";
import {
  EnvironmentsAccordion,
  EnvironmentsAccordionDetails,
  EnvironmentsAccordionSummary,
} from "./components/EnvironmentsAccordion";
import { EditEnvironmentName } from "./EditEnvironmentName";
import { useEnvironmentsUiStateStore } from "./stores/useEnvironmentsUiStateStore";

export const EnvironmentProperties = () => {
  const {
    isPropertiesOpen,
    setIsPropertiesOpen,
  } = useEnvironmentsUiStateStore();

  const handleChangeIsOpen = (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setIsPropertiesOpen(isExpanded);
  };

  return (
    <EnvironmentsAccordion
      expanded={isPropertiesOpen}
      onChange={handleChangeIsOpen}
    >
      <EnvironmentsAccordionSummary
        aria-controls="environment-properties"
        id="environment-properties-header"
      >
        <Typography component="h5" variant="h6">
          Properties
        </Typography>
      </EnvironmentsAccordionSummary>
      <EnvironmentsAccordionDetails
        sx={{ paddingTop: (theme) => theme.spacing(2) }}
      >
        <EditEnvironmentName />
        <EnvironmentImagesRadioGroup />
      </EnvironmentsAccordionDetails>
    </EnvironmentsAccordion>
  );
};
