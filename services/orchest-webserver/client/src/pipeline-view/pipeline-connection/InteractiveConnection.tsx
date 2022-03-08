import { Position } from "@/types";
import classNames from "classnames";
import React from "react";
import { getSvgProperties, getTransformProperty } from "./common";
import { ConnectionLine } from "./ConnectionLine";

export const InteractiveConnection = ({
  getPosition,
  startNodeUUID,
  endNodeUUID,
  selected,
  shouldUpdate,
  stepDomRefs,
  ...props
}: {
  startNodeX: number;
  startNodeY: number;
  endNodeX: number | undefined;
  endNodeY: number | undefined;
  selected: boolean;
  startNodeUUID: string;
  endNodeUUID?: string;
  getPosition: (element: HTMLElement | undefined) => Position | null;
  shouldUpdate: [boolean, boolean];
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
}) => {
  const [transformProperty, setTransformProperty] = React.useState(() =>
    getTransformProperty(props)
  );
  const [svgProperties, setSvgProperties] = React.useState(() =>
    getSvgProperties(props)
  );

  const [shouldUpdateStart, shouldUpdateEnd] = shouldUpdate;

  const containerRef = React.useRef<HTMLDivElement>();

  const startNode = stepDomRefs.current[`${startNodeUUID}-outgoing`];
  const endNode = stepDomRefs.current[`${endNodeUUID}-incoming`];
  const startNodePosition = getPosition(startNode);
  const endNodePosition = getPosition(endNode);

  const startNodeX = shouldUpdateStart ? startNodePosition.x : props.startNodeX;
  const startNodeY = shouldUpdateStart ? startNodePosition.y : props.startNodeY;
  const endNodeX = shouldUpdateEnd ? endNodePosition.x : props.endNodeX;
  const endNodeY = shouldUpdateEnd ? endNodePosition.y : props.endNodeY;

  const transform = React.useCallback(() => {
    setTransformProperty(
      getTransformProperty({
        startNodeX,
        startNodeY,
        endNodeX,
        endNodeY,
      })
    );
  }, [endNodeX, endNodeY, startNodeX, startNodeY, setTransformProperty]);

  const redraw = React.useCallback(() => {
    transform();
    setSvgProperties(
      getSvgProperties({
        startNodeX,
        startNodeY,
        endNodeX,
        endNodeY,
      })
    );
  }, [endNodeX, endNodeY, startNodeX, startNodeY, transform]);

  const shouldTransform = shouldUpdateStart && shouldUpdateEnd;

  const shouldRedrawSvg =
    !shouldTransform && (shouldUpdateStart || shouldUpdateEnd);

  React.useEffect(() => {
    if (shouldTransform) transform();
    if (shouldRedrawSvg) redraw();
  }, [shouldTransform, shouldRedrawSvg, redraw, transform]);

  const { className, width, height, drawn } = svgProperties;

  const zIndex = -1;

  return (
    <div
      data-start-uuid={startNodeUUID}
      data-end-uuid={endNodeUUID}
      className={classNames("connection", className)}
      ref={containerRef}
      style={{ zIndex, ...transformProperty }}
    >
      <ConnectionLine
        width={width}
        height={height}
        d={drawn}
        selected={selected}
      />
    </div>
  );
};
