import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import { styled } from "@mui/material/styles";
import React from "react";
import { useEnvironmentsUiStateStore } from "../stores/useEnvironmentsUiStateStore";

const StyledAccordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))({ "&:before": { display: "none" } });

export const EnvironmentsAccordion = (props: AccordionProps) => {
  const { reset } = useEnvironmentsUiStateStore();
  React.useEffect(() => {
    return () => reset();
  }, [reset]);

  return <StyledAccordion {...props} />;
};

export const EnvironmentsAccordionSummary = styled(
  (props: AccordionSummaryProps) => (
    <MuiAccordionSummary expandIcon={<ExpandMoreIcon />} {...props} />
  )
)({ padding: 0 });

export const EnvironmentsAccordionDetails = styled(MuiAccordionDetails)({
  padding: 0,
});
