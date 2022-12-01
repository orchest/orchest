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
    <Stack direction="row" alignItems="space-between" maxWidth={900}>
      <Typography variant="body2" color="text.secondary" flex="1 1 auto">
        Incoming:&nbsp;
        {connections.incoming.length ? (
          <Listed items={connections.incoming}>
            {(step) => <StepLink step={step} />}
          </Listed>
        ) : (
          <Typography variant="body2" color="text.disabled" component="span">
            None
          </Typography>
        )}
      </Typography>

      <SeparatorArrow />

      <Typography
        variant="body2"
        color="text.secondary"
        flex="1 0 auto"
        whiteSpace="nowrap"
      >
        Step:&nbsp;
        <Typography variant="body2" color="text.primary" component="span">
          {step?.title || step?.file_path ? basename(step?.file_path) : ""}
        </Typography>
      </Typography>

      <SeparatorArrow />

      <Typography variant="body2" color="text.secondary" flex="1 1 auto">
        Outgoing:&nbsp;
        {connections.outgoing.length ? (
          <Listed items={connections.outgoing}>
            {(step) => <StepLink step={step} />}
          </Listed>
        ) : (
          <Typography variant="body2" color="text.disabled" component="span">
            None
          </Typography>
        )}
      </Typography>
    </Stack>
  );
};

const SeparatorArrow = () => (
  <Box flex="1 0 auto" paddingX={5} position="relative">
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
