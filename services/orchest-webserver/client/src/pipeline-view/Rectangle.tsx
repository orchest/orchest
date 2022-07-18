import React from "react";

export const getStepSelectorRectangle = (stepSelector: {
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

export type RectangleProps = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export const Rectangle = ({ width, height, x, y }: RectangleProps) => {
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
