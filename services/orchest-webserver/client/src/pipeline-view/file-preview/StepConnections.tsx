import { Listed } from "@/components/Listed";
import { RouteLink } from "@/components/RouteLink";
import { useActiveStep } from "@/hooks/useActiveStep";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { useStepConnections } from "@/hooks/useStepConnections";
import { StepData } from "@/types";
import { basename } from "@/utils/path";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export const StepFileConnections = () => {
  const step = useActiveStep();
  const connections = useStepConnections(step?.uuid);

  return (
    <Stack direction="row" paddingX={2} paddingY={1} alignItems="flex-start">
      <Typography variant="subtitle2" color="text.secondary" flex="1 0.5 auto">
        Incoming:&nbsp;
        <Listed items={connections.incoming}>
          {(step) => <StepLink step={step} />}
        </Listed>
      </Typography>

      <SeparatorArrow />

      <Typography
        variant="subtitle2"
        color="text.secondary"
        flex="1 0 auto"
        whiteSpace="nowrap"
      >
        Step:&nbsp;
        <Typography variant="subtitle2" color="text.primary" component="span">
          {step?.title ?? step?.file_path ? basename(step?.file_path) : ""}
        </Typography>
      </Typography>

      <SeparatorArrow />

      <Typography variant="subtitle2" color="text.secondary" flex="1 1 auto">
        Outgoing:&nbsp;
        <Listed items={connections.outgoing}>
          {(step) => <StepLink step={step} />}
        </Listed>
      </Typography>
    </Stack>
  );
};

const SeparatorArrow = () => (
  <Box flex="0" paddingX={5} position="relative">
    <ArrowForwardOutlined sx={{ position: "absolute" }} color="disabled" />
  </Box>
);

type StepLinkProps = { step: StepData };

const StepLink = ({ step }: StepLinkProps) => {
  const url = useRouteLink("filePreview", { stepUuid: step.uuid });

  return (
    <RouteLink underline="hover" to={url}>
      {basename(step.file_path)}
    </RouteLink>
  );
};
