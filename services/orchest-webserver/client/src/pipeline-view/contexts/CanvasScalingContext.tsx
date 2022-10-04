import { getOffset } from "@/utils/element";
import { Point2D } from "@/utils/geometry";
import { clamp } from "@/utils/math";
import { getMousePoint } from "@/utils/mouse";
import React from "react";
import { usePipelineRefs } from "./PipelineRefsContext";

export type CanvasScaling = {
  scaleFactor: number;
  setScaleFactor: React.Dispatch<React.SetStateAction<number>>;
  /** Given a position within the browser window, returns the unscaled position on the canvas. */
  windowToCanvasPoint: (windowPoint: Point2D) => Point2D;
  /** Returns the point on the canvas where the pointer is currently located. */
  canvasPointAtPointer: () => Point2D;
};

export const CanvasScalingContext = React.createContext<CanvasScaling>({
  scaleFactor: -1,
  setScaleFactor: () => void 0,
  windowToCanvasPoint: () => [0, 0],
  canvasPointAtPointer: () => [0, 0],
});

export const useCanvasScaling = () => React.useContext(CanvasScalingContext);

export const SCALE_INCREMENTS = [0.13, 0.25, 0.5, 1, 2] as const;
export const SCALE_UNIT = 0.25;
export const DEFAULT_SCALE_FACTOR = 1;
export const MIN_SCALE_FACTOR = SCALE_INCREMENTS[0];
export const MAX_SCALE_FACTOR = SCALE_INCREMENTS[SCALE_INCREMENTS.length - 1];

const clampScaleFactor = (value: number) =>
  clamp(value, MIN_SCALE_FACTOR, MAX_SCALE_FACTOR);

export const CanvasScalingProvider: React.FC = ({ children }) => {
  const { pipelineCanvasRef } = usePipelineRefs();

  const [scaleFactor, originalSetScaleFactor] = React.useState(
    DEFAULT_SCALE_FACTOR
  );

  const setScaleFactor = React.useCallback(
    (value: React.SetStateAction<number>) => {
      if (value instanceof Function) {
        originalSetScaleFactor((current) => clampScaleFactor(value(current)));
      } else {
        originalSetScaleFactor(clampScaleFactor(value));
      }
    },
    []
  );

  const windowToCanvasPoint = React.useCallback(
    ([x, y]: Readonly<Point2D>): Point2D => {
      const [offsetX, offsetY] = getOffset(pipelineCanvasRef.current);

      return [(x - offsetX) / scaleFactor, (y - offsetY) / scaleFactor];
    },
    [scaleFactor, pipelineCanvasRef]
  );

  const canvasPointAtPointer = React.useCallback(
    () => windowToCanvasPoint(getMousePoint()),
    [windowToCanvasPoint]
  );

  return (
    <CanvasScalingContext.Provider
      value={{
        scaleFactor,
        setScaleFactor,
        windowToCanvasPoint,
        canvasPointAtPointer,
      }}
    >
      {children}
    </CanvasScalingContext.Provider>
  );
};
