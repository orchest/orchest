import { AccordionDetails, AccordionSummary } from "@/components/Accordion";
import { EnvironmentImagesRadioGroup } from "@/environments-view/edit-environment/EnvironmentImagesRadioGroup";
import Typography from "@mui/material/Typography";
import React from "react";
import {
  EnvironmentAccordion,
  useEnvironmentAccordions,
} from "./components/EnvironmentAccordion";
import { EditEnvironmentName } from "./EditEnvironmentName";

export const EnvironmentProperties = () => {
  const { isPropertiesOpen, setIsPropertiesOpen } = useEnvironmentAccordions();

  const handleChangeIsOpen = (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setIsPropertiesOpen(isExpanded);
  };

  return (
    <EnvironmentAccordion
      expanded={isPropertiesOpen}
      onChange={handleChangeIsOpen}
    >
      <AccordionSummary
        aria-controls="environment-properties"
        id="environment-properties-header"
      >
        <Typography component="h5" variant="h6">
          Properties
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ paddingTop: (theme) => theme.spacing(2) }}>
        <EditEnvironmentName />
        <EnvironmentImagesRadioGroup />
      </AccordionDetails>
    </EnvironmentAccordion>
  );
};
