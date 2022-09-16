import { Point2D } from "@/utils/geometry";
import React from "react";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useUpdateZIndex } from "../hooks/useZIndexMax";
import { getSvgProperties, getTransformProperty } from "./common";
import { ConnectionLine } from "./ConnectionLine";

type PipelineConnectionProps = {
  shouldRedraw: boolean;
  isNew: boolean;
  startPoint: Point2D;
  endPoint?: Point2D | undefined;
  startNodeUUID: string;
  endNodeUUID?: string;
  selected: boolean;
  shouldUpdate: readonly [boolean, boolean];
  getPosition: (element: HTMLElement) => Point2D;
};

const PipelineConnectionComponent = ({
  shouldRedraw,
  isNew,
  getPosition,
  selected,
  startNodeUUID,
  endNodeUUID,
  shouldUpdate,
  startPoint,
  endPoint,
}: PipelineConnectionProps) => {
  const { keysDown, newConnection, stepRefs, zIndexMax } = usePipelineRefs();
  const {
    uiState: { grabbedStep },
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const [transformProperty, setTransformProperty] = React.useState(() =>
    getTransformProperty(startPoint, endPoint)
  );
  const [svgProperties, setSvgProperties] = React.useState(() =>
    getSvgProperties(startPoint, endPoint)
  );

  const [shouldUpdateStart, shouldUpdateEnd] = shouldUpdate;

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const startNode = stepRefs.current[`${startNodeUUID}-outgoing`];
  const endNode = stepRefs.current[`${endNodeUUID}-incoming`];

  const start =
    shouldUpdateStart && startNode ? getPosition(startNode) : startPoint;

  const newConnectionEnd = newConnection.current?.end;

  const end =
    shouldUpdateEnd && endNode
      ? getPosition(endNode)
      : newConnectionEnd
      ? newConnectionEnd
      : endPoint || startPoint;

  const transform = React.useCallback(() => {
    setTransformProperty(getTransformProperty(start, end));
  }, [start, end]);

  const redraw = React.useCallback(() => {
    transform();
    setSvgProperties(getSvgProperties(start, end));
  }, [end, start, transform]);

  // Similar to PipelineStep, here we track the positions of startNode and endNode
  // via stepRefs, and update the SVG accordingly
  // so that we can ONLY re-render relevant connections and get away from performance penalty

  const shouldRedrawSvg =
    (grabbedStep || isNew) && (shouldUpdateStart || shouldUpdateEnd);

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
    (event) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;
      if (event.button === 0 && endNodeUUID) {
        event.stopPropagation();
        uiStateDispatch({
          type: "SELECT_CONNECTION",
          payload: { startNodeUUID, endNodeUUID },
        });
      }
    },
    [uiStateDispatch, startNodeUUID, endNodeUUID, keysDown]
  );

  const { sx, width, height, drawn } = svgProperties;

  return (
    <ConnectionLine
      ref={containerRef}
      selected={selected}
      startNodeUuid={startNodeUUID}
      endNodeUuid={endNodeUUID}
      onContextMenu={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
      style={{ ...transformProperty, zIndex }}
      onClick={onClickFun}
      width={width}
      height={height}
      d={drawn}
      sx={sx}
    />
  );
};

export const PipelineConnection = React.memo(PipelineConnectionComponent);
