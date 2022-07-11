import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { CreateStepButton } from "./CreateStepButton";
import { PipelineMoreOptionsMenu } from "./PipelineMoreOptionsMenu";
import { ServicesMenu } from "./services/ServicesMenu";
import { useServices } from "./services/useServices";

export const PipelineCanvasHeaderBar = ({
  pipelineViewportRef,
  pipelineRunning,
}: {
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineRunning: boolean;
}) => {
  const servicesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const {
    isShowingServices,
    services,
    showServices,
    hideServices,
  } = useServices(pipelineRunning);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
        padding: (theme) => theme.spacing(0, 2),
      }}
    >
      <Stack direction="row" alignItems="baseline" sx={{ flex: 1 }}>
        <Typography component="h2" variant="subtitle2">
          Something
        </Typography>
        <Typography variant="caption">.orchest</Typography>
      </Stack>
      <Button size="small">Logs</Button>
      <Button
        size="small"
        id="running-services-button"
        onClick={showServices}
        endIcon={<ArrowDropDownOutlinedIcon />}
        ref={servicesButtonRef}
      >
        Services
      </Button>
      <ServicesMenu
        isOpen={isShowingServices}
        onClose={hideServices}
        anchor={servicesButtonRef}
        services={services}
      />
      <Divider
        orientation="vertical"
        sx={{ height: (theme) => theme.spacing(3) }}
      />
      <CreateStepButton pipelineViewportRef={pipelineViewportRef} />
      <PipelineMoreOptionsMenu />
    </Stack>
  );
};
