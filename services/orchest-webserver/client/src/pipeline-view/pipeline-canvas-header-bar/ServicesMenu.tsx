import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import React from "react";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { ServicesMenuComponent } from "./ServicesMenuComponent";
import { useServices } from "./useServices";

export const ServicesMenu = () => {
  const { displayedPipelineStatus } = useInteractiveRunsContext();
  const servicesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const { anchor, services, showServices, hideServices } = useServices(
    displayedPipelineStatus === "RUNNING"
  );
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
        onClose={hideServices}
        anchor={anchor}
        services={services}
      />
    </>
  );
};
