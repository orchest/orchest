import {
  ClientPosition,
  useDragElementWithPosition,
} from "@/hooks/useDragElementWithPosition";
import { getOffset } from "@/utils/jquery-replacement";
import { isNumber } from "@/utils/webserver-utils";
import Box, { BoxProps } from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import React from "react";

const ResizeBaseComponent = styled(Box)({
  position: "absolute",
  userSelect: "none",
});

export type ElementSize = { width: number | string; height: number | string };
type ResizeContextType = {
  size: ElementSize;
  resize: (e: React.MouseEvent) => void;
  resizeWidth: (e: React.MouseEvent) => void;
  resizeHeight: (e: React.MouseEvent) => void;
};

const getSizeValue = (value: string | number) =>
  !isNumber(value) ? value : `${value}px`;

/**
 * `ResizableContainer` can be resized by calling the functions passed by the render props.
 * Assign the appropriate function to `onMouseDown` of the matching element.
 * For example, assign `resizeWidth` to `ResizeWidthBar`.
 */
export const ResizableContainer = ({
  children,
  onResized,
  initialWidth,
  initialHeight,
  minHeight,
  maxHeight,
  minWidth,
  maxWidth,
  ...props
}: BoxProps & {
  initialWidth?: number;
  initialHeight?: number;
  onResized?: (size: ElementSize) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children: (props: ResizeContextType) => React.ReactNode;
}) => {
  const containerRef = React.useRef<HTMLElement>();

  const [size, setSize] = React.useState<ElementSize>({
    width: initialWidth || "100%",
    height: initialHeight || "100%",
  });

  React.useEffect(() => {
    if (size.height > maxHeight || size.width > maxWidth) {
      setSize((current) => {
        return {
          width: isNumber(current.width)
            ? Math.min(current.width, maxWidth)
            : current.width,
          height: isNumber(current.height)
            ? Math.min(current.height, maxHeight)
            : current.height,
        };
      });
    }
  }, [maxWidth, maxHeight, size]);

  const getNewWidth = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>): number => {
      const { left } = getOffset(containerRef.current);
      // Offset 5 pixels to get cursor above drag handler (to show appropriate mouse cursor)
      let newWidth = minWidth
        ? Math.max(minWidth, position.current.prev.x - left)
        : position.current.prev.x - left;

      return maxWidth ? Math.min(newWidth, maxWidth) : newWidth;
    },
    [maxWidth, minWidth, containerRef]
  );

  const getNewHeight = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>): number => {
      const { top } = getOffset(containerRef.current);

      let newHeight = minHeight
        ? Math.max(minHeight, position.current.prev.y - top)
        : position.current.prev.y - top;

      return maxHeight ? Math.min(newHeight, maxHeight) : newHeight;
    },
    [maxHeight, minHeight, containerRef]
  );

  const onResizeWidth = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      const width = getNewWidth(position);

      setSize((current) => ({ ...current, width: width + 5 }));
    },
    [getNewWidth]
  );

  const onResizeHeight = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      const height = getNewHeight(position);

      setSize((current) => ({ ...current, height }));
    },
    [getNewHeight]
  );

  const onResize = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      const width = getNewWidth(position);
      const height = getNewHeight(position);

      setSize({ width, height });
    },
    [getNewWidth, getNewHeight]
  );

  const onStopDragging = React.useCallback(() => {
    if (onResized) {
      setSize((current) => {
        onResized(current);
        return current;
      });
    }
  }, [onResized]);

  const resize = useDragElementWithPosition(onResize, onStopDragging);
  const resizeWidth = useDragElementWithPosition(onResizeWidth, onStopDragging);
  const resizeHeight = useDragElementWithPosition(
    onResizeHeight,
    onStopDragging
  );
  return (
    <Box
      ref={containerRef}
      style={{
        minWidth: getSizeValue(size.width),
        maxWidth: getSizeValue(size.width),
        minHeight: getSizeValue(size.height),
        maxHeight: getSizeValue(size.height),
      }}
      {...props}
    >
      {children({
        size,
        resize,
        resizeWidth,
        resizeHeight,
      })}
    </Box>
  );
};

export const ResizeCorner = React.forwardRef<
  typeof Box,
  BoxProps & {
    resize: (e: React.MouseEvent) => void;
  }
>(function ResizeBarComponent({ sx, onMouseDown, resize, ...props }, ref) {
  return (
    <ResizeBaseComponent
      sx={{
        width: (theme) => theme.spacing(1),
        height: (theme) => theme.spacing(1),
        bottom: 0,
        right: 0,
        ...sx,
      }}
      {...props}
      onMouseDown={(e) => {
        resize(e);
        if (onMouseDown) onMouseDown(e);
      }}
      ref={ref}
    />
  );
});

export const ResizeWidthBar = React.forwardRef<
  typeof Box,
  BoxProps & {
    resizeWidth: (e: React.MouseEvent) => void;
    side: "left" | "right";
  }
>(function ResizeBarComponent(
  { sx, side, onMouseDown, resizeWidth, ...props },
  ref
) {
  return (
    <ResizeBaseComponent
      sx={{
        height: "100%",
        width: (theme) => theme.spacing(1),
        top: 0,
        [side]: 5,
        cursor: "col-resize",
        ...sx,
      }}
      {...props}
      onMouseDown={(e) => {
        resizeWidth(e);
        if (onMouseDown) onMouseDown(e);
      }}
      ref={ref}
    />
  );
});

export const ResizeHeightBar = React.forwardRef<
  typeof Box,
  BoxProps & {
    resizeHeight: (e: React.MouseEvent) => void;
  }
>(function ResizeBarComponent(
  { sx, resizeHeight, onMouseDown, ...props },
  ref
) {
  return (
    <ResizeBaseComponent
      sx={{
        width: "100%",
        height: (theme) => theme.spacing(1),
        bottom: -5,
        cursor: "row-resize",
        ...sx,
      }}
      {...props}
      onMouseDown={(e) => {
        resizeHeight(e);
        if (onMouseDown) onMouseDown(e);
      }}
      ref={ref}
    />
  );
});
