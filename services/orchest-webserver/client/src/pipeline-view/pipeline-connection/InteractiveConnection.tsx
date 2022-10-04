import { Point2D } from "@/utils/geometry";
import React from "react";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { getSvgProperties, getTransformProperty } from "./common";
import { ConnectionLine } from "./ConnectionLine";

type InteractiveConnectionProps = {
  startPoint: Point2D;
  endPoint?: Point2D;
  selected: boolean;
  startNodeUUID: string;
  endNodeUUID: string;
  getPosition: (element: HTMLElement) => Point2D;
  shouldUpdate: [boolean, boolean];
};

/** This connection is rendered when a step is being moved in the pipeline editor. */
export const InteractiveConnection = ({
  getPosition,
  startNodeUUID,
  endNodeUUID,
  selected,
  shouldUpdate: [shouldUpdateStart, shouldUpdateEnd],
  startPoint,
  endPoint,
}: InteractiveConnectionProps) => {
  const { stepRefs } = usePipelineRefs();

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const startNode = stepRefs.current[`${startNodeUUID}-outgoing`];
  const endNode = stepRefs.current[`${endNodeUUID}-incoming`];
  const start = React.useMemo(() => {
    if (shouldUpdateStart && startNode) {
      return getPosition(startNode);
    } else {
      return startPoint;
    }
  }, [getPosition, shouldUpdateStart, startNode, startPoint]);

  const end = React.useMemo(() => {
    if (shouldUpdateEnd && endNode) {
      return getPosition(endNode);
    } else {
      return endPoint;
    }
  }, [endNode, endPoint, getPosition, shouldUpdateEnd]);

  const transformProperty = React.useMemo(
    () => getTransformProperty(start, end),
    [end, start]
  );

  const svgProperties = React.useMemo(() => getSvgProperties(start, end), [
    end,
    start,
  ]);

  const { sx, width, height, drawn } = svgProperties;

  const zIndex = -1;

  return (
    <ConnectionLine
      ref={containerRef}
      startNodeUuid={startNodeUUID}
      endNodeUuid={endNodeUUID}
      width={width}
      height={height}
      d={drawn}
      selected={selected}
      sx={sx}
      style={{ zIndex, ...transformProperty }}
    />
  );
};
