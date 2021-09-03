import React from "react";

const getStepSelectorRectangle = (stepSelector: {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) => {
  return {
    x: Math.min(stepSelector.x1, stepSelector.x2),
    y: Math.min(stepSelector.y1, stepSelector.y2),
    width: Math.abs(stepSelector.x2 - stepSelector.x1),
    height: Math.abs(stepSelector.y2 - stepSelector.y1),
  };
};

const Rectangle = ({
  width,
  height,
  x,
  y,
}: {
  width: number;
  height: number;
  x: number;
  y: number;
}) => {
  return (
    <div
      className="step-selector"
      style={{
        width: width,
        height: height,
        left: x,
        top: y,
      }}
    ></div>
  );
};

export { getStepSelectorRectangle, Rectangle };
