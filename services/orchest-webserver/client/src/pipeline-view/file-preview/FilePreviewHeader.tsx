import { FileDescription } from "@/api/file-viewer/fileViewerApi";
import { useActiveStep } from "@/hooks/useActiveStep";
import { useRouteLink } from "@/hooks/useCustomRoute";
import { basename, join } from "@/utils/path";
import { ellipsis } from "@/utils/styles";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { StepFileConnections } from "./StepFileConnections";
import { StepPipelineSelector } from "./StepPipelineSelector";

export type FilePreviewHeaderProps = { file: FileDescription };

export const FilePreviewHeader = ({ file }: FilePreviewHeaderProps) => {
  const [showConnections, setShowConnections] = React.useState(true);

  const toggleConnections = () => setShowConnections((current) => !current);

  return (
    <Stack sx={{ borderBottom: (theme) => `1px solid ${theme.borderColor}` }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        width="inherit"
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          borderBottom: (theme) =>
            `1px solid ${showConnections ? theme.borderColor : "transparent"}`,
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
            {basename(file.filename)}
          </Typography>
        </Stack>

        <Stack direction="row" flexShrink={0} spacing={1.5} alignItems="center">
          <Button onClick={toggleConnections}>
            {showConnections ? "Hide connections" : "Show connections"}
          </Button>

          <JupyterLabButton />

          <IconButton title="More options" size="small">
            <MoreHorizOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={showConnections}>
        <Stack spacing={1} paddingX={3} paddingY={1.5}>
          <StepPipelineSelector />
          <StepFileConnections />
        </Stack>
      </Collapse>
    </Stack>
  );
};

const JupyterLabButton = () => {
  const step = useActiveStep();
  const { pipelineCwd } = usePipelineDataContext();
  const url = useRouteLink("jupyterLab", {
    filePath:
      pipelineCwd && step?.file_path ? join(pipelineCwd, step.file_path) : "/",
  });

  return (
    <Button variant="contained" href={url} disabled={!step}>
      Edit in JupyterLab
    </Button>
  );
};
