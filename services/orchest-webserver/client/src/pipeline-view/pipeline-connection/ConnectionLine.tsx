import theme from "@/theme";
import React from "react";

export const ConnectionLine = ({
  onClick,
  selected,
  width,
  height,
  d,
}: React.SVGProps<SVGPathElement> & {
  selected?: boolean;
}) => {
  return (
    <svg width={width} height={height}>
      <path
        id="path"
        stroke={selected ? theme.palette.primary.main : "#000"}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        d={d}
      />
      <path
        id="path-clickable"
        onClick={onClick}
        stroke="transparent"
        strokeWidth={4}
        fill="none"
        d={d}
      />
    </svg>
  );
};
