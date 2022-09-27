import { SxProps } from "@mui/material";
import Box from "@mui/material/Box";
import React from "react";
import { PIPELINE_CANVAS_SIZE } from "../hooks/usePipelineCanvasState";

/** How many pixels the background overflows in each direction. */
const BACKGROUND_OVERFLOW = 5000;
/** The total background size in pixels. */
const BACKGROUND_SIZE = PIPELINE_CANVAS_SIZE + BACKGROUND_OVERFLOW * 2;

const backgroundStyle: SxProps = {
  position: "absolute",
  backgroundSize: 32,
  backgroundImage: "url(/image/grid-dot.svg)",
  backgroundRepeat: "repeat",
  width: BACKGROUND_SIZE,
  height: BACKGROUND_SIZE,
  left: -BACKGROUND_OVERFLOW,
  top: -BACKGROUND_OVERFLOW,
};

export const PipelineCanvasBackground = () => {
  return <Box sx={backgroundStyle} />;
};
