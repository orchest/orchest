import React from "react";

/**
 * this hook returns a function that should be assigned to onMouseDown prop of an element
 */
export const useDragElement = ({
  onStartDragging,
  onDragging,
  onStopDragging,
}: {
  onStartDragging?: (e: React.MouseEvent) => void;
  onDragging?: (e: MouseEvent) => void;
  onStopDragging?: (e: MouseEvent) => void;
}) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const hasStartedTrackingMouseMove = React.useRef(false);

  const startDragging = React.useCallback(
    function (e: React.MouseEvent) {
      // we only want to pick up mouse left key
      // if user use right click, e.nativeEvent.button === 3
      if (e.nativeEvent.button === 0) {
        setIsDragging(true);
        if (onStartDragging) onStartDragging(e);
      }
    },
    [onStartDragging]
  );

  const onMouseMove = React.useCallback(
    (e: MouseEvent) => {
      setIsDragging((isDragging) => {
        if (isDragging && onDragging) onDragging(e);
        return isDragging;
      });
    },
    [onDragging]
  );

  const onMouseUp = React.useCallback(
    (e: MouseEvent) => {
      setIsDragging((isDragging) => {
        if (isDragging && onStopDragging) onStopDragging(e);
        return false;
      });
    },
    [onStopDragging]
  );

  React.useEffect(() => {
    if (isDragging && !hasStartedTrackingMouseMove.current) {
      hasStartedTrackingMouseMove.current = true;
      window.addEventListener("mousemove", onMouseMove);
    }
    return () => {
      hasStartedTrackingMouseMove.current = false;
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [isDragging, onMouseMove]);

  React.useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseUp]);

  return startDragging;
};
