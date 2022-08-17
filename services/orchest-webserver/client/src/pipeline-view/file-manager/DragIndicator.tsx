import { addPoints, Point2D, stringifyPoint } from "@/utils/geometry";
import { basename, dirname } from "@/utils/path";
import Box from "@mui/material/Box";
import React from "react";
import { pathFromElement } from "./common";
import { useFileManagerContext } from "./FileManagerContext";

const DRAG_INIT_OFFSET: Readonly<Point2D> = [10, 10];

export const DragIndicator = ({
  handleMouseUp,
  dragFiles,
}: {
  handleMouseUp: (target: HTMLElement) => void;
  dragFiles: string[];
}) => {
  const { setHoveredPath, resetMove } = useFileManagerContext();

  const [dragOffset, setDragOffset] = React.useState<Readonly<Point2D>>(
    DRAG_INIT_OFFSET
  );

  const mouseMoveHandler = React.useCallback(
    (event: MouseEvent) => {
      const path = pathFromElement(event.target as HTMLElement);
      if (path) {
        setHoveredPath(!path.endsWith("/") ? dirname(path) : path);
      }
      setDragOffset(
        addPoints([event.clientX, event.clientY], DRAG_INIT_OFFSET)
      );
    },
    [setDragOffset, setHoveredPath]
  );

  const triggerHandleMouseUp = React.useCallback(
    (e: MouseEvent) => {
      handleMouseUp(e.target as HTMLElement);
      resetMove();
    },
    [handleMouseUp, resetMove]
  );

  let mouseUpHandler = React.useCallback(
    (e: MouseEvent) => {
      triggerHandleMouseUp(e);
    },
    [triggerHandleMouseUp]
  );

  let keyUpHandler = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        resetMove();
      }
    },
    [resetMove]
  );

  let listenerRefs = React.useRef({
    mouseMoveHandler,
    mouseLeaveHandler: resetMove,
    mouseUpHandler,
    keyUpHandler,
  });

  React.useEffect(() => {
    const mouseMoveHandlerWrapper = (event: MouseEvent) =>
      listenerRefs.current.mouseMoveHandler(event);
    const mouseLeaveHandlerWrapper = () =>
      listenerRefs.current.mouseLeaveHandler();
    const mouseUpHandlerWrapper = (e: MouseEvent) =>
      listenerRefs.current.mouseUpHandler(e);
    const keyUpHandlerWrapper = (e: KeyboardEvent) =>
      listenerRefs.current.keyUpHandler(e);

    document.body.addEventListener("mousemove", mouseMoveHandlerWrapper);
    document.body.addEventListener("mouseleave", mouseLeaveHandlerWrapper);
    document.body.addEventListener("mouseup", mouseUpHandlerWrapper);
    document.body.addEventListener("keyup", keyUpHandlerWrapper);

    return () => {
      document.body.removeEventListener("mousemove", mouseMoveHandlerWrapper);
      document.body.removeEventListener("mouseleave", mouseLeaveHandlerWrapper);
      document.body.removeEventListener("mouseup", mouseUpHandlerWrapper);
      document.body.removeEventListener("keyup", keyUpHandlerWrapper);
    };
  }, []);

  React.useEffect(() => {
    listenerRefs.current.mouseMoveHandler = mouseMoveHandler;
    listenerRefs.current.mouseLeaveHandler = resetMove;
    listenerRefs.current.mouseUpHandler = mouseUpHandler;
    listenerRefs.current.keyUpHandler = keyUpHandler;
  }, [mouseMoveHandler, mouseUpHandler, keyUpHandler, resetMove]);
  return (
    <Box
      sx={{ position: "fixed", top: 0, left: 0, zIndex: 999 }}
      style={{
        transform: `translate(${stringifyPoint(dragOffset, "px")})`,
      }}
    >
      <Box
        sx={{
          padding: "1px 7px",
          background: (theme) => theme.palette.grey[100],
          color: (theme) => theme.palette.primary.main,
        }}
      >
        {dragFiles.length === 1 ? basename(dragFiles[0]) : dragFiles.length}
      </Box>
    </Box>
  );
};
