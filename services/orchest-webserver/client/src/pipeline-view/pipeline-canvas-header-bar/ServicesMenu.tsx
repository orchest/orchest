import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import React from "react";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { ServicesMenuComponent } from "./ServicesMenuComponent";
import { useServices } from "./useServices";

export const ServicesMenu = () => {
  const { pipelineRunning } = useInteractiveRunsContext();
  const servicesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const {
    isShowingServices,
    services,
    showServices,
    hideServices,
  } = useServices(pipelineRunning);
  return (
    <>
      <Button
        size="small"
        id="running-services-button"
        onClick={showServices}
        endIcon={<ArrowDropDownOutlinedIcon />}
        ref={servicesButtonRef}
      >
        Services
      </Button>
      <ServicesMenuComponent
        isOpen={isShowingServices}
        onClose={hideServices}
        anchor={servicesButtonRef}
        services={services}
      />
    </>
  );
};
