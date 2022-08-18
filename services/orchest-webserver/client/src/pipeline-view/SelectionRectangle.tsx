import { Rect } from "@/utils/geometry";
import React from "react";

export const SelectionRectangle = ({ origin: [x, y], width, height }: Rect) => {
  return (
    <div
      className="step-selector"
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    />
  );
};
