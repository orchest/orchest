import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { CreateStepButton } from "../CreateStepButton";
import { PipelineFileName } from "./PipelineFileName";
import { PipelineMoreOptionsMenu } from "./PipelineMoreOptionsMenu";
import { PrimaryPipelineButton } from "./primary-action/PrimaryPipelineButton";
import { ServicesMenu } from "./ServicesMenu";

export const PipelineCanvasHeaderBar = () => {
  const { isSnapshot, isJobRun } = usePipelineDataContext();
  const { setFullscreenTab } = usePipelineCanvasContext();
  const openLogs = () => setFullscreenTab("logs");

  return (
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
        <PipelineFileName />
      </Stack>
      <Stack direction="row" flexShrink={0} spacing={1.5} alignItems="center">
        <Button size="small" onClick={openLogs} disabled={isSnapshot}>
          Logs
        </Button>
        <ServicesMenu />
        <Divider
          orientation="vertical"
          sx={{ height: (theme) => theme.spacing(3) }}
        />
        {!isSnapshot && !isJobRun && <CreateStepButton />}
        <PrimaryPipelineButton />
        <PipelineMoreOptionsMenu />
      </Stack>
    </Stack>
  );
};
