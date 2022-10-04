import {
  ClientPosition,
  useDragElementWithPosition,
} from "@/hooks/useDragElementWithPosition";
import { windowOffsetLeft, windowOffsetTop } from "@/utils/jquery-replacement";
import { setRefs } from "@/utils/refs";
import Box, { BoxProps } from "@mui/material/Box";
import { styled, SxProps, Theme } from "@mui/material/styles";
import React from "react";

export type ResizeAnchor = "left" | "right" | "bottom" | "top";
export type ResizeDirection = "horizontal" | "vertical";

export type ResizableContainerProps = BoxProps & {
  /** Controls whether the height or width is being resized */
  direction: ResizeDirection;
  /**
   * Where the pane is anchored to and scales from.
   * The default is "left" for horizontal, and "bottom" for vertical.
   */
  anchor?: ResizeAnchor;
  /** Depending on the `direction`, controls the initial width or height */
  initialSize?: number;
  /** Called each time the size value changes.*/
  onSetSize?: (size: number) => void;
  /** Called immediately when the resizing has stopped */
  onResized?: (size: number) => void;
};

/** The width/height of the area the you can grab to resize, in pixels. */
const HANDLE_SIZE = 4;

/**
 * Creates a MUI Box component which can be resized
 * either vertically or horizontally.
 */
export const ResizablePane = React.forwardRef<
  HTMLDivElement,
  ResizableContainerProps
>(function ResizablePane(
  {
    children,
    onSetSize,
    onResized,
    direction,
    initialSize = 0,
    anchor = direction === "vertical" ? "bottom" : "left",
    ...props
  },
  ref
) {
  const localRef = React.useRef<HTMLDivElement>();
  const [size, setSize] = React.useState(initialSize);

  const onResize = React.useCallback(
    function onResize(position: React.MutableRefObject<ClientPosition>) {
      if (!localRef.current) return;

      if (direction === "vertical") {
        const [, prevY] = position.current.prev;
        const top = windowOffsetTop(localRef.current);

        if (anchor === "top") {
          setSize(prevY - top + HANDLE_SIZE);
        } else {
          const bottom = window.innerHeight - top;

          setSize(window.innerHeight - prevY - bottom + HANDLE_SIZE);
        }
      } else {
        const left = windowOffsetLeft(localRef.current);
        const [prevX] = position.current.prev;

        if (anchor === "left") {
          setSize(prevX - left + HANDLE_SIZE);
        } else {
          const right = window.innerWidth - localRef.current.clientWidth - left;

          setSize(window.innerWidth - prevX - right + HANDLE_SIZE);
        }
      }
    },
    [anchor, direction]
  );

  React.useEffect(() => onSetSize?.(size), [size, onSetSize]);

  const resize = useDragElementWithPosition(onResize, () => onResized?.(size));

  return (
    <Box
      flexGrow="0"
      flexShrink="0"
      {...props}
      ref={setRefs(localRef, ref)}
      style={direction === "vertical" ? { height: size } : { width: size }}
    >
      {children}
      <DragHandle anchor={anchor} startResize={resize} />
    </Box>
  );
});

type DragHandleProps = {
  anchor: ResizeAnchor;
  startResize: (event: React.MouseEvent) => void;
};

const DragHandle = React.memo(function DragHandle({
  anchor,
  startResize,
}: DragHandleProps) {
  const [isResizing, setIsResizing] = React.useState(false);

  const getSx = (anchor: ResizeAnchor): SxProps<Theme> => {
    switch (anchor) {
      default:
        return {
          width: HANDLE_SIZE,
          height: "100%",
          position: "absolute",
          cursor: "col-resize",
          userSelect: "none",
          top: 0,
          bottom: 0,
          [anchor === "right" ? "left" : "right"]: 0,
        };
      case "top":
      case "bottom":
        return {
          width: "100%",
          height: HANDLE_SIZE,
          position: "absolute",
          cursor: "row-resize",
          userSelect: "none",
          left: 0,
          right: 0,
          [anchor === "top" ? "bottom" : "top"]: 0,
        };
    }
  };

  const Handle = styled(Box)`
    transition: opacity 100ms ease-in;
    background-color: ${({ theme }) => theme.palette.primary.light};
    opacity: 0;

    &:hover,
    &.resizing {
      transition: opacity 650ms 650ms ease-out;
      opacity: 0.4;
    }
  `;

  const onMouseDown = (event: React.MouseEvent) => {
    startResize(event);
    setIsResizing(true);
  };

  React.useEffect(() => {
    const resizingStopped = () => setIsResizing(false);

    document.addEventListener("mouseup", resizingStopped);
    return () => document.removeEventListener("mouseup", resizingStopped);
  }, []);

  return (
    <Handle
      sx={getSx(anchor)}
      className={isResizing ? "resizing" : undefined}
      onMouseDown={onMouseDown}
    />
  );
});
