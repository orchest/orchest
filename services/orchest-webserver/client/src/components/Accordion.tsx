import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import { styled } from "@mui/material/styles";
import React from "react";

export const Accordion = styled(
  React.forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
    props,
    ref
  ) {
    return (
      <MuiAccordion disableGutters elevation={0} square {...props} ref={ref} />
    );
  })
)({ "&:before": { display: "none" } });

export const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={
      <ArrowForwardIosSharpIcon
        sx={{ fontSize: (theme) => theme.spacing(2) }}
      />
    }
    {...props}
  />
))(({ theme }) => ({
  paddingLeft: 0,
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    marginLeft: theme.spacing(1),
  },
}));

export const AccordionDetails = styled(MuiAccordionDetails)({
  padding: 0,
});
