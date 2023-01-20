import { RouteLink } from "@/components/RouteLink";
import { useActiveStep } from "@/hooks/useActiveStep";
import { ellipsis } from "@/utils/styles";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useJupyterLabLink } from "../hooks/useJupyterLabLink";
import { FilePreviewMoreOptionsButton } from "./FilePreviewMoreOptionsButton";
import { useFilePreviewState } from "./hooks/useFilePreviewState";
import { StepFileConnections } from "./StepFileConnections";
import { StepPipelineSelector } from "./StepPipelineSelector";

export type FilePreviewHeaderProps = { name: string; isStep: boolean };

export const FilePreviewHeader = ({ name, isStep }: FilePreviewHeaderProps) => {
  const showConnections = useFilePreviewState((s) => s.showConnections);
  const setShowConnections = useFilePreviewState((s) => s.setShowConnections);
  const toggleConnections = () => setShowConnections(!showConnections);
  const activeStep = useActiveStep();
  const jupyterLabUrl = useJupyterLabLink(activeStep);
  const { isReadOnly } = usePipelineDataContext();

  return (
    <Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        width="inherit"
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          borderBottom: (theme) => `1px solid ${theme.borderColor}`,
          padding: (theme) => theme.spacing(0, 3, 0, 2),
          height: (theme) => theme.spacing(7),
        }}
      >
        <Stack
          direction="row"
          alignItems="baseline"
          minWidth={0}
          flexShrink={1}
          width="inherit"
        >
          <Typography component="h2" variant="h5" sx={ellipsis()}>
            {name}
          </Typography>
        </Stack>

        <Stack direction="row" flexShrink={0} spacing={1.5} alignItems="center">
          {isStep && (
            <Button onClick={toggleConnections}>
              {showConnections ? "Hide connections" : "Show connections"}
            </Button>
          )}

          <Button
            LinkComponent={RouteLink}
            variant="contained"
            disabled={isReadOnly}
            href={jupyterLabUrl}
          >
            Edit in JupyterLab
          </Button>

          <FilePreviewMoreOptionsButton />
        </Stack>
      </Stack>

      {isStep && (
        <Collapse in={showConnections}>
          <Stack
            sx={{
              spacing: 1,
              paddingX: 3,
              paddingY: 1.5,
              borderBottom: (theme) => `1px solid ${theme.borderColor}`,
              "&:empty": { display: "none" },
            }}
          >
            <StepPipelineSelector />
            <StepFileConnections />
          </Stack>
        </Collapse>
      )}
    </Stack>
  );
};
