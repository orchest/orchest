import { CommaSeparated } from "@/components/CommaSeparated";
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

  if (!connections.incoming.length && !connections.outgoing.length) return null;

  return (
    <Stack direction="row" alignItems="space-between" maxWidth={1000}>
      <Typography variant="body2" color="text.secondary" flex="1 1 auto">
        Incoming:&nbsp;
        {connections.incoming.length ? (
          <CommaSeparated items={connections.incoming}>
            {(step) => <StepLink step={step} />}
          </CommaSeparated>
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
          <CommaSeparated items={connections.outgoing}>
            {(step) => <StepLink step={step} />}
          </CommaSeparated>
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
  <Box flex="0.25 2 auto" paddingLeft={8} position="relative">
    <ArrowForwardOutlined
      sx={{ position: "absolute", left: (theme) => theme.spacing(2) }}
      color="disabled"
    />
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
