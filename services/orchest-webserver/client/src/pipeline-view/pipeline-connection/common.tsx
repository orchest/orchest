import classNames from "classnames";

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
  let line = [];
  let mx = x1 + (x2 - x1) / 2;

  line.push("M", x1, y1);
  line.push("C", mx, y1, mx, y2, x2, y2);

  return line.join(" ");
};

export const getTransformProperty = ({
  startNodeX,
  startNodeY,
  endNodeX = startNodeX,
  endNodeY = startNodeY,
}: {
  startNodeX: number;
  startNodeY: number;
  endNodeX?: number;
  endNodeY?: number;
}) => {
  let targetX = endNodeX - startNodeX;
  let targetY = endNodeY - startNodeY;

  let xOffset = Math.min(targetX, 0);
  let yOffset = Math.min(targetY, 0);

  const translateX = startNodeX - svgPadding + xOffset;
  const translateY = startNodeY - svgPadding + yOffset - lineHeight / 2;

  return {
    transform: `translateX(${translateX}px) translateY(${translateY}px)`,
  };
};

export const getSvgProperties = ({
  startNodeX,
  startNodeY,
  endNodeX = startNodeX,
  endNodeY = startNodeY,
}: {
  startNodeX: number;
  startNodeY: number;
  endNodeX?: number;
  endNodeY?: number;
}) => {
  let targetX = endNodeX - startNodeX;
  let targetY = endNodeY - startNodeY;

  let xOffset = Math.min(targetX, 0);
  let yOffset = Math.min(targetY, 0);

  const width = Math.abs(targetX) + 2 * svgPadding + "px";
  const height = Math.abs(targetY) + 2 * svgPadding + "px";
  const drawn = curvedHorizontal(
    svgPadding - xOffset,
    svgPadding - yOffset,
    svgPadding + targetX - xOffset - arrowWidth,
    svgPadding + targetY - yOffset
  );

  const className = classNames(
    targetX < arrowWidth * 10 && "flipped-horizontal",
    targetY < 0 && "flipped"
  );

  return { width, height, drawn, className };
};
