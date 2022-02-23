import theme from "@/theme";
import { Position } from "@/types";
import classNames from "classnames";
import React from "react";

// set SVG properties
const lineHeight = 2;
const svgPadding = 5;
const arrowWidth = 7;

const curvedHorizontal = function (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  let line = [];
  let mx = x1 + (x2 - x1) / 2;

  line.push("M", x1, y1);
  line.push("C", mx, y1, mx, y2, x2, y2);

  return line.join(" ");
};

const ConnectionLine = ({
  onMouseDown,
  selected,
  width,
  height,
  d,
}: React.SVGProps<SVGPathElement> & { selected: boolean }) => {
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
        onMouseDown={onMouseDown}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
        d={d}
      />
    </svg>
  );
};

const getRenderProperties = ({
  startNodeX,
  startNodeY,
  endNodeX,
  endNodeY,
}: {
  startNodeX: number;
  startNodeY: number;
  endNodeX: number;
  endNodeY: number;
}) => {
  let targetX = endNodeX - startNodeX;
  let targetY = endNodeY - startNodeY;

  let xOffset = Math.min(targetX, 0);
  let yOffset = Math.min(targetY, 0);

  const translateX = startNodeX - svgPadding + xOffset;
  const translateY = startNodeY - svgPadding + yOffset - lineHeight / 2;

  let style = {
    transform: `translateX(${translateX}px) translateY(${translateY}px)`,
  };

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

  return { width, height, drawn, style, className };
};

const _PipelineConnection: React.FC<{
  startNodeX: number;
  startNodeY: number;
  endNodeX: number | undefined;
  endNodeY: number | undefined;
  startNodeUUID: string;
  endNodeUUID?: string;
  getPosition: (element: HTMLElement) => Position;
  onClick: (e: MouseEvent) => void;
  selected: boolean;
  shouldUpdate: [boolean, boolean];
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  selectedSingleStep: React.MutableRefObject<string>;
}> = ({
  startNodeX,
  endNodeX,
  endNodeY,
  startNodeY,
  getPosition,
  onClick,
  selected,
  startNodeUUID,
  endNodeUUID,
  shouldUpdate,
  stepDomRefs,
  selectedSingleStep,
}) => {
  const [renderProperties, setRenderProperties] = React.useState(() =>
    getRenderProperties({
      startNodeX,
      endNodeX,
      endNodeY,
      startNodeY,
    })
  );

  const [shouldUpdateStart, shouldUpdateEnd] = shouldUpdate;

  const containerRef = React.useRef<HTMLDivElement>();

  const onMouseMove = React.useCallback(() => {
    if (selectedSingleStep.current && (shouldUpdateStart || shouldUpdateEnd)) {
      const startNode = stepDomRefs.current[`${startNodeUUID}-outgoing`];
      const endNode = stepDomRefs.current[`${endNodeUUID}-incoming`];

      const startNodePosition = getPosition(startNode);
      const endNodePosition = getPosition(endNode);

      setRenderProperties((current) => {
        return {
          ...current,
          ...getRenderProperties({
            startNodeX: shouldUpdateStart ? startNodePosition.x : startNodeX,
            startNodeY: shouldUpdateStart ? startNodePosition.y : startNodeY,
            endNodeX: shouldUpdateEnd ? endNodePosition.x : endNodeX,
            endNodeY: shouldUpdateEnd ? endNodePosition.y : endNodeY,
          }),
        };
      });
    }
  }, [
    startNodeX,
    endNodeX,
    endNodeY,
    startNodeY,
    endNodeUUID,
    startNodeUUID,
    getPosition,
    stepDomRefs,
    selectedSingleStep,
    shouldUpdateStart,
    shouldUpdateEnd,
  ]);

  // Similar to PipelineStep, here we track the positions of startNode and endNode
  // via stepDomRefs, and update the SVG accordingly
  // so that we can ONLY re-render relevant connections and get away from performance penalty
  React.useEffect(() => {
    document.body.addEventListener("mousemove", onMouseMove);
    return () => document.body.removeEventListener("mousemove", onMouseMove);
  }, [onMouseMove]);

  const onMouseDown = React.useCallback((e) => {
    if (onClick) onClick(e);
  }, []);

  const { style, className, width, height, drawn } = renderProperties;

  return (
    <div
      data-start-uuid={startNodeUUID}
      data-end-uuid={endNodeUUID}
      className={classNames("connection", className, selected && "selected")}
      ref={containerRef}
      style={style}
    >
      <ConnectionLine
        selected={selected}
        onMouseDown={onMouseDown}
        width={width}
        height={height}
        d={drawn}
      />
    </div>
  );
};

export const PipelineConnection = React.memo(_PipelineConnection);
