import { Point2D } from "@/utils/geometry";
import { SxProps, Theme } from "@mui/material";

// set SVG properties
export const lineHeight = 2;
export const svgPadding = 5;
export const arrowWidth = 7;

export const curvedHorizontal = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  let line: (number | string)[] = [];
  let mx = x1 + (x2 - x1) / 2;

  line.push("M", x1, y1);
  line.push("C", mx, y1, mx, y2, x2, y2);

  return line.join(" ");
};

export const getTransformProperty = (
  [startNodeX, startNodeY]: Point2D,
  [endNodeX, endNodeY]: Point2D = [startNodeX, startNodeY]
) => {
  const targetX = endNodeX - startNodeX;
  const targetY = endNodeY - startNodeY;

  const xOffset = Math.min(targetX, 0);
  const yOffset = Math.min(targetY, 0);

  const translateX = startNodeX - svgPadding + xOffset;
  const translateY = startNodeY - svgPadding + yOffset - lineHeight / 2;

  return {
    transform: `translateX(${translateX}px) translateY(${translateY}px)`,
  };
};

export const getSvgProperties = (
  [startNodeX, startNodeY]: Point2D,
  [endNodeX, endNodeY]: Point2D = [startNodeX, startNodeY]
) => {
  const targetX = endNodeX - startNodeX;
  const targetY = endNodeY - startNodeY;

  const xOffset = Math.min(targetX, 0);
  const yOffset = Math.min(targetY, 0);

  const width = Math.abs(targetX) + 2 * svgPadding + "px";
  const height = Math.abs(targetY) + 2 * svgPadding + "px";
  const drawn = curvedHorizontal(
    svgPadding - xOffset,
    svgPadding - yOffset,
    svgPadding + targetX - xOffset - arrowWidth,
    svgPadding + targetY - yOffset
  );

  const sx: SxProps<Theme> = {
    ...(targetX < arrowWidth * 10
      ? {
          opacity: 0,
        }
      : null),
    ...(targetY < 0
      ? {
          bottom: "auto",
          top: "-1px",
        }
      : null),
  };

  return { width, height, drawn, sx };
};
