import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import React from "react";
import { CreateStepButton } from "./CreateStepButton";
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
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
        padding: (theme) => theme.spacing(0, 2),
      }}
    >
      <Box sx={{ flex: 1 }}>Something.orchest</Box>
      <Button>Logs</Button>
      <Button
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
        flexItem
        sx={{ height: (theme) => theme.spacing(4.5) }}
      />
      <CreateStepButton pipelineViewportRef={pipelineViewportRef} />
    </Stack>
  );
};
