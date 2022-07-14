import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
import { CreateStepButton } from "../CreateStepButton";
import { PipelineOperations } from "./pipeline-operations/PipelineOperations";
import { PipelineFileName } from "./PipelineFileName";
import { PipelineMoreOptionsMenu } from "./PipelineMoreOptionsMenu";
import { ServicesMenu } from "./ServicesMenu";

export const PipelineCanvasHeaderBar = () => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
        padding: (theme) => theme.spacing(0, 3, 0, 2),
        height: (theme) => theme.spacing(7),
      }}
    >
      <PipelineFileName />
      <Button size="small">Logs</Button>
      <ServicesMenu />
      <Divider
        orientation="vertical"
        sx={{ height: (theme) => theme.spacing(3) }}
      />
      <CreateStepButton />
      <PipelineOperations />
      <PipelineMoreOptionsMenu />
    </Stack>
  );
};
