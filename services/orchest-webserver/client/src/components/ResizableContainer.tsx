import {
  ClientPosition,
  useDragElementWithPosition,
} from "@/hooks/useDragElementWithPosition";
import { getOffset } from "@/utils/jquery-replacement";
import { isNumber } from "@/utils/webserver-utils";
import Box, { BoxProps } from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import { hasValue } from "@orchest/lib-utils";
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

export type ResizableContainerProps = Omit<
  BoxProps,
  "maxWidth" | "maxHeight" | "minWidth" | "minHeight" | "ref"
> & {
  ref?: React.Ref<HTMLDivElement>;
  initialWidth?: number;
  initialHeight?: number;
  onResized?: (size: ElementSize) => void;
  onSetSize?: (size: ElementSize) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children: (props: ResizeContextType) => React.ReactNode;
};

export const ResizableContainer = React.forwardRef<
  HTMLDivElement,
  ResizableContainerProps
>(
  (
    {
      children,
      onSetSize,
      onResized,
      initialWidth,
      initialHeight,
      minHeight,
      maxHeight,
      minWidth,
      maxWidth,
      ...props
    },
    ref
  ) => {
    const localRef = React.useRef<HTMLDivElement>();

    const [size, originalSetSize] = React.useState<ElementSize>({
      width: initialWidth || "100%",
      height: initialHeight || "100%",
    });

    const setSize = React.useCallback(
      (value: React.SetStateAction<ElementSize>) => {
        originalSetSize((current) => {
          const newSize = value instanceof Function ? value(current) : value;
          onSetSize?.(newSize);
          return newSize;
        });
      },
      [onSetSize]
    );

    React.useEffect(() => {
      if (
        (hasValue(maxWidth) && size.width > maxWidth) ||
        (hasValue(maxHeight) && size.height > maxHeight)
      ) {
        setSize((current) => {
          return {
            width:
              isNumber(current.width) && hasValue(maxWidth)
                ? Math.min(current.width, maxWidth)
                : current.width,
            height:
              isNumber(current.height) && hasValue(maxHeight)
                ? Math.min(current.height, maxHeight)
                : current.height,
          };
        });
      }
    }, [maxWidth, maxHeight, size, setSize]);

    const getNewWidth = React.useCallback(
      (position: React.MutableRefObject<ClientPosition>): number => {
        const { left } = getOffset(localRef.current);
        // Offset 5 pixels to get cursor above drag handler (to show appropriate mouse cursor)
        const newWidth = minWidth
          ? Math.max(minWidth, position.current.prev.x - left)
          : position.current.prev.x - left;

        return maxWidth ? Math.min(newWidth, maxWidth) : newWidth;
      },
      [maxWidth, minWidth, localRef]
    );

    const getNewHeight = React.useCallback(
      (position: React.MutableRefObject<ClientPosition>): number => {
        const { top } = getOffset(localRef.current);

        const newHeight = minHeight
          ? Math.max(minHeight, position.current.prev.y - top)
          : position.current.prev.y - top;

        return maxHeight ? Math.min(newHeight, maxHeight) : newHeight;
      },
      [maxHeight, minHeight, localRef]
    );

    const onResizeWidth = React.useCallback(
      (position: React.MutableRefObject<ClientPosition>) => {
        const width = getNewWidth(position);

        setSize((current) => ({ ...current, width: width + 5 }));
      },
      [getNewWidth, setSize]
    );

    const onResizeHeight = React.useCallback(
      (position: React.MutableRefObject<ClientPosition>) => {
        const height = getNewHeight(position);

        setSize((current) => ({ ...current, height }));
      },
      [getNewHeight, setSize]
    );

    const onResize = React.useCallback(
      (position: React.MutableRefObject<ClientPosition>) => {
        const width = getNewWidth(position);
        const height = getNewHeight(position);

        setSize({ width, height });
      },
      [getNewWidth, getNewHeight, setSize]
    );

    const onStopDragging = React.useCallback(() => {
      onResized?.(size);
    }, [onResized, size]);

    const resize = useDragElementWithPosition(onResize, onStopDragging);
    const resizeWidth = useDragElementWithPosition(
      onResizeWidth,
      onStopDragging
    );
    const resizeHeight = useDragElementWithPosition(
      onResizeHeight,
      onStopDragging
    );
    return (
      <Box
        {...props}
        ref={(node: HTMLDivElement) => {
          // in order to manipulate a forwarded ref, we need to create a local ref to capture it
          localRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        style={{
          minWidth: getSizeValue(size.width),
          maxWidth: getSizeValue(size.width),
          minHeight: getSizeValue(size.height),
          maxHeight: getSizeValue(size.height),
        }}
      >
        {children({
          size,
          resize,
          resizeWidth,
          resizeHeight,
        })}
      </Box>
    );
  }
);

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
        [side]: (theme) => theme.spacing(0.5),
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
        bottom: (theme) => theme.spacing(-1),
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
