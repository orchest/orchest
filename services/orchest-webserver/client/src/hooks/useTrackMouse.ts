import { Point2D } from "@/utils/geometry";
import { useCallback, useEffect, useRef } from "react";

export type MouseRef = {
  /** The current screen coordinates of the mouse. */
  point: Point2D;
  /** How much the mouse was moved since last update. */
  delta: Point2D;
};

export const useTrackMouse = () => {
  const ref = useRef<MouseRef>({
    point: [0, 0],
    delta: [0, 0],
  });

  const updatePointer = useCallback(
    ({ clientX, clientY }: MouseEvent) => {
      const [previousX, previousY] = ref.current.point;

      ref.current.delta[0] = clientX - previousX;
      ref.current.delta[1] = clientY - previousY;
      ref.current.point[0] = clientX;
      ref.current.point[1] = clientY;
    },
    [ref]
  );

  const getMousePoint = useCallback(
    (): Readonly<Point2D> => ref.current.point,
    [ref]
  );
  const getMouseDelta = useCallback(
    (): Readonly<Point2D> => ref.current.delta,
    [ref]
  );

  useEffect(() => {
    document.body.addEventListener("mousemove", updatePointer);

    return () => document.body.removeEventListener("mousemove", updatePointer);
  }, [updatePointer]);

  return { getMousePoint, getMouseDelta };
};
