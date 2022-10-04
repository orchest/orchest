import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Button from "@mui/material/Button";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";

type ZoomButtonProps = {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
};

const ZoomButton = ({ icon, onClick, label }: ZoomButtonProps) => {
  return (
    <Button
      onClick={() => onClick()}
      arial-label={label}
      sx={{
        borderColor: (theme) => theme.palette.grey[400],
        padding: (theme) => theme.spacing(0.375, 0.875),
      }}
    >
      {icon}
    </Button>
  );
};

export const ZoomInButton = () => {
  const { zoomIn } = usePipelineCanvasContext();
  return (
    <ZoomButton
      label="Zoom in"
      onClick={zoomIn}
      icon={<AddIcon sx={{ fontSize: 16 }} />}
    />
  );
};

export const ZoomOutButton = () => {
  const { zoomOut } = usePipelineCanvasContext();
  return (
    <ZoomButton
      label="Zoom out"
      onClick={zoomOut}
      icon={<RemoveIcon sx={{ fontSize: 16 }} />}
    />
  );
};
