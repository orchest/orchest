import { NewConnection, Position } from "@/types";
import classNames from "classnames";
import React from "react";
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
  getPosition: (element: HTMLElement | undefined) => Position | null;
  eventVarsDispatch: React.Dispatch<EventVarsAction>;
  selected: boolean;
  movedToTop: boolean;
  zIndexMax: React.MutableRefObject<number>;
  shouldUpdate: [boolean, boolean];
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  cursorControlledStep: string;
  newConnection: React.MutableRefObject<NewConnection>;
}> = ({
  shouldRedraw,
  isNew,
  getPosition,
  eventVarsDispatch,
  selected,
  movedToTop,
  zIndexMax,
  startNodeUUID,
  endNodeUUID,
  shouldUpdate,
  stepDomRefs,
  cursorControlledStep,
  newConnection,
  ...props
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
  const endNodePosition = getPosition(endNode) || {
    x: newConnection.current?.xEnd,
    y: newConnection.current?.yEnd,
  };

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

  // movedToTop: when associated step is selected
  // shouldRedraw && isNew: user is creating
  const shouldMoveToTop =
    isNew ||
    movedToTop ||
    selected ||
    [startNodeUUID, endNodeUUID].includes(cursorControlledStep);

  // -1 is to ensure connection lines are beneath the step that is on focus (i.e. the top step amongst all).
  // selected means that only THIS connection is selected, we just need to make it on top of everything
  const zIndex = useUpdateZIndex(shouldMoveToTop, zIndexMax, selected ? 0 : -1);

  const onClickFun = React.useCallback(
    (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        eventVarsDispatch({
          type: "SELECT_CONNECTION",
          payload: { startNodeUUID, endNodeUUID },
        });
      }
    },
    [eventVarsDispatch, startNodeUUID, endNodeUUID]
  );

  const { className, width, height, drawn } = svgProperties;

  return (
    <div
      data-start-uuid={startNodeUUID}
      data-end-uuid={endNodeUUID}
      className={classNames("connection", className, selected && "selected")}
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
