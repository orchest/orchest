import { NewConnection, Position } from "@/types";
import classNames from "classnames";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { EventVarsAction } from "../hooks/useEventVars";
import { useUpdateZIndex } from "../hooks/useZIndexMax";
import { getSvgProperties, getTransformProperty } from "./common";
import { ConnectionLine } from "./ConnectionLine";

const PipelineConnectionComponent: React.FC<{
  shouldRedraw: boolean;
  isNew: boolean;
  startNodeX: number;
  startNodeY: number;
  endNodeX: number | undefined;
  endNodeY: number | undefined;
  startNodeUUID: string;
  endNodeUUID?: string;
  getPosition: (element: HTMLElement | undefined | null) => Position | null;
  eventVarsDispatch: React.Dispatch<EventVarsAction>;
  selected: boolean;
  zIndexMax: React.MutableRefObject<number>;
  shouldUpdate: [boolean, boolean];
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cursorControlledStep: string | undefined;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
}> = ({
  shouldRedraw,
  isNew,
  getPosition,
  eventVarsDispatch,
  selected,
  zIndexMax,
  startNodeUUID,
  endNodeUUID,
  shouldUpdate,
  stepDomRefs,
  cursorControlledStep,
  newConnection,
  ...props
}) => {
  const { keysDown } = usePipelineEditorContext();
  const [transformProperty, setTransformProperty] = React.useState(() =>
    getTransformProperty(props)
  );
  const [svgProperties, setSvgProperties] = React.useState(() =>
    getSvgProperties(props)
  );

  const [shouldUpdateStart, shouldUpdateEnd] = shouldUpdate;

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const startNode = stepDomRefs.current[`${startNodeUUID}-outgoing`];
  const endNode = stepDomRefs.current[`${endNodeUUID}-incoming`];
  const startNodePosition = getPosition(startNode);
  const endNodePosition = getPosition(endNode) || {
    x: newConnection.current?.xEnd,
    y: newConnection.current?.yEnd,
  };

  const startNodeX =
    shouldUpdateStart && startNodePosition
      ? startNodePosition.x
      : props.startNodeX;
  const startNodeY =
    shouldUpdateStart && startNodePosition
      ? startNodePosition.y
      : props.startNodeY;
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

  // Similar to PipelineStep, here we track the positions of startNode and endNode
  // via stepDomRefs, and update the SVG accordingly
  // so that we can ONLY re-render relevant connections and get away from performance penalty

  const shouldRedrawSvg =
    (cursorControlledStep || isNew) && (shouldUpdateStart || shouldUpdateEnd);

  const onMouseMove = React.useCallback(() => {
    if (shouldRedrawSvg) redraw();
  }, [redraw, shouldRedrawSvg]);

  React.useEffect(() => {
    document.body.addEventListener("mousemove", onMouseMove);
    return () => document.body.removeEventListener("mousemove", onMouseMove);
  }, [onMouseMove]);

  React.useEffect(() => {
    if (shouldRedraw) redraw();
  }, [shouldRedraw]); // eslint-disable-line react-hooks/exhaustive-deps

  // only moved to top if user is creating a new connection
  const zIndex = useUpdateZIndex(isNew, zIndexMax);

  const onClickFun = React.useCallback(
    (e) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;
      if (e.button === 0 && endNodeUUID) {
        e.stopPropagation();
        eventVarsDispatch({
          type: "SELECT_CONNECTION",
          payload: { startNodeUUID, endNodeUUID },
        });
      }
    },
    [eventVarsDispatch, startNodeUUID, endNodeUUID, keysDown]
  );

  const { className, width, height, drawn } = svgProperties;

  return (
    <div
      data-start-uuid={startNodeUUID}
      data-end-uuid={endNodeUUID}
      className={classNames("connection", className, selected && "selected")}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      ref={containerRef}
      style={{ ...transformProperty, zIndex }}
    >
      <ConnectionLine
        selected={selected}
        onClick={onClickFun}
        width={width}
        height={height}
        d={drawn}
      />
    </div>
  );
};

export const PipelineConnection = React.memo(PipelineConnectionComponent);
