import Box from "@mui/material/Box";
import React from "react";
import { ResizeStepDetailsBar } from "../components/ResizeStepDetailsBar";
import { usePipelineCanvasDimensionsContext } from "../contexts/PipelineCanvasDimensionsContext";

type StepDetailsContainerBoxProps = {
  children: React.ReactNode;
};

const StepDetailsContainerBox = ({
  children,
}: StepDetailsContainerBoxProps) => {
  const { stepDetailsPanelWidth } = usePipelineCanvasDimensionsContext();

  return (
    <Box
      style={{ width: `${stepDetailsPanelWidth}px` }}
      sx={{
        height: "100%",
        backgroundColor: (theme) => theme.palette.common.white,
        borderLeft: (theme) => `1px solid ${theme.palette.grey[300]}`,
        width: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Box>
  );
};

type StepDetailsContainerProps = {
  children: React.ReactNode;
};

export const StepDetailsContainer = ({
  children,
}: StepDetailsContainerProps) => {
  return (
    <StepDetailsContainerBox>
      <ResizeStepDetailsBar />
      {children}
    </StepDetailsContainerBox>
  );
};
