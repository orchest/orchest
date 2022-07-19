import { Position } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import React from "react";
import { getScaleCorrectedPosition, scaleCorrected } from "../common";
import { usePipelineRefs } from "./PipelineRefsContext";

export type ScaleFactorContextType = {
  scaleFactor: number;
  setScaleFactor: React.Dispatch<React.SetStateAction<number>>;
  trackMouseMovement: (clientX: number, clientY: number) => void;
  getOnCanvasPosition: (offset?: Position) => Position;
};

export const ScaleFactorContext = React.createContext<ScaleFactorContextType>(
  {} as ScaleFactorContextType
);

export const useScaleFactor = () => React.useContext(ScaleFactorContext);

export const DEFAULT_SCALE_FACTOR = 1;
export const SCALE_UNIT = 0.25;
export const MIN_SCALE_FACTOR = 0.25;
export const MAX_SCALE_FACTOR = 2;

const getRangedScaleFactor = (value: number) =>
  Math.min(Math.max(value, MIN_SCALE_FACTOR), MAX_SCALE_FACTOR);

export const ScaleFactorProvider: React.FC = ({ children }) => {
  const { mouseTracker, pipelineCanvasRef } = usePipelineRefs();
  const [scaleFactor, originalSetScaleFactor] = React.useState(
    DEFAULT_SCALE_FACTOR
  );

  const setScaleFactor = React.useCallback(
    (value: React.SetStateAction<number>) => {
      if (value instanceof Function) {
        originalSetScaleFactor((current) => {
          const newValue = value(current);
          return getRangedScaleFactor(newValue);
        });
        return;
      }
      return originalSetScaleFactor(getRangedScaleFactor(value));
    },
    []
  );

  // this function doesn't trigger update, it simply persists clientX clientY for calculation
  const trackMouseMovement = React.useCallback(
    (clientX: number, clientY: number) => {
      mouseTracker.current.client = { x: clientX, y: clientY };

      // get the distance of the movement, and update prevPosition
      const previous = mouseTracker.current.prev;

      mouseTracker.current.delta = {
        x: scaleCorrected(clientX, scaleFactor) - previous.x,
        y: scaleCorrected(clientY, scaleFactor) - previous.y,
      };

      mouseTracker.current.prev = {
        x: scaleCorrected(clientX, scaleFactor),
        y: scaleCorrected(clientY, scaleFactor),
      };

      const unscaledPrev = mouseTracker.current.unscaledPrev;

      mouseTracker.current.unscaledDelta = {
        x: clientX - unscaledPrev.x,
        y: clientY - unscaledPrev.y,
      };

      mouseTracker.current.unscaledPrev = {
        x: clientX,
        y: clientY,
      };
    },
    [scaleFactor, mouseTracker]
  );

  React.useEffect(() => {
    const startTracking = (e: MouseEvent) =>
      trackMouseMovement(e.clientX, e.clientY);
    document.body.addEventListener("mousemove", startTracking);
    return () => document.body.removeEventListener("mousemove", startTracking);
  }, [trackMouseMovement]);

  const getOnCanvasPosition = React.useCallback(
    (offset: Position = { x: 0, y: 0 }): Position => {
      const clientPosition = {
        x: mouseTracker.current.client.x - offset.x,
        y: mouseTracker.current.client.y - offset.y,
      };
      const { x, y } = getScaleCorrectedPosition({
        offset: getOffset(pipelineCanvasRef.current),
        position: clientPosition,
        scaleFactor,
      });

      return { x, y };
    },
    [scaleFactor, mouseTracker, pipelineCanvasRef]
  );

  return (
    <ScaleFactorContext.Provider
      value={{
        scaleFactor,
        setScaleFactor,
        trackMouseMovement,
        getOnCanvasPosition,
      }}
    >
      {children}
    </ScaleFactorContext.Provider>
  );
};
