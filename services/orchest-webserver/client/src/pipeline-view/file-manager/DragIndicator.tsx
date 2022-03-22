import { Position } from "@/types";
import Box from "@mui/material/Box";
import React from "react";
import {
  baseNameFromPath,
  deriveParentPath,
  filePathFromHTMLElement,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";

const DRAG_INIT_OFFSET_X = 10;
const DRAG_INIT_OFFSET_Y = 10;

export const DragIndicator = ({
  handleMouseUp,
  dragFiles,
}: {
  handleMouseUp: (target: HTMLElement) => void;
  dragFiles: string[];
}) => {
  const { setHoveredPath, resetMove } = useFileManagerContext();

  const [dragOffset, setDragOffset] = React.useState<Position>({
    x: DRAG_INIT_OFFSET_X,
    y: DRAG_INIT_OFFSET_Y,
  });

  let mouseMoveHandler = React.useCallback(
    (e: MouseEvent) => {
      let path = filePathFromHTMLElement(e.target as HTMLElement);
      if (path) {
        setHoveredPath(!path.endsWith("/") ? deriveParentPath(path) : path);
      }
      setDragOffset({
        x: e.clientX + DRAG_INIT_OFFSET_X,
        y: e.clientY + DRAG_INIT_OFFSET_Y,
      });
    },
    [setDragOffset, setHoveredPath]
  );

  let mouseLeaveHandler = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (e: MouseEvent) => {
      resetMove();
    },
    [resetMove]
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
    mouseLeaveHandler,
    mouseUpHandler,
    keyUpHandler,
  });

  React.useEffect(() => {
    let mouseMoveHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseMoveHandler(e);
    };
    let mouseLeaveHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseLeaveHandler(e);
    };
    let mouseUpHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseUpHandler(e);
    };
    let keyUpHandlerWrapper = (e: KeyboardEvent) => {
      listenerRefs.current.keyUpHandler(e);
    };

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
    listenerRefs.current.mouseLeaveHandler = mouseLeaveHandler;
    listenerRefs.current.mouseUpHandler = mouseUpHandler;
    listenerRefs.current.keyUpHandler = keyUpHandler;
  }, [mouseMoveHandler, mouseLeaveHandler, mouseUpHandler, keyUpHandler]);
  return (
    <Box
      sx={{ position: "fixed", top: 0, left: 0, zIndex: 999 }}
      style={{
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px)`,
      }}
    >
      <Box
        sx={{
          padding: "1px 7px",
          background: (theme) => theme.palette.grey[100],
          color: (theme) => theme.palette.primary.main,
        }}
      >
        {dragFiles.length === 1
          ? baseNameFromPath(dragFiles[0])
          : dragFiles.length}
      </Box>
    </Box>
  );
};
