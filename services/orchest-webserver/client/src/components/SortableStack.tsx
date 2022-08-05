import { useDragElement } from "@/hooks/useDragElement";
import { firstAncestor } from "@/utils/element";
import Stack from "@mui/material/Stack";
import { Theme, useTheme } from "@mui/material/styles";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type SortableStackProps = {
  onUpdate: (oldIndex: number, newIndex: number) => Promise<void>;
  children: React.ReactChild[];
  disabled?: boolean;
};

const isDragItem = (element: Element) =>
  element.classList.contains("drag-item");

const isDragContainer = (element: Element) =>
  element.classList.contains("drag-container");

export const SortableStack = ({
  children,
  onUpdate,
  disabled = false,
}: SortableStackProps) => {
  const [[startX, startY], setStart] = useState([NaN, NaN] as const);
  const [[x, y], setPosition] = useState([NaN, NaN] as const);
  const [startIndex, setStartIndex] = useState(-1);
  const [index, setIndex] = useState(-1);
  const [element, setElement] = useState<HTMLElement>();
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>();
  const theme = useTheme();

  const shouldReset = useMemo(() => y && startY && Math.abs(y - startY) < 10, [
    y,
    startY,
  ]);

  const onStartDragging = React.useCallback(
    (event: React.MouseEvent) => {
      if (isUpdating) return;
      if (!containerRef.current) return;
      const dragged = firstAncestor(event.target as Element, isDragItem);

      if (dragged instanceof HTMLElement) {
        const children = [...containerRef.current.children];

        setStartIndex(children.findIndex((item) => item === dragged));
        setStart([event.pageX, event.pageY]);
        setPosition([event.pageX, event.pageY]);
        setElement(dragged);
      }
    },
    [isUpdating]
  );

  const onDragging = React.useCallback(
    (event: MouseEvent) => setPosition([event.pageX, event.pageY]),
    []
  );

  const onStopDragging = React.useCallback(() => {
    if (isUpdating) return;
    setIsUpdating(true);
    onUpdate(startIndex, index).then(() => {
      setPosition([NaN, NaN]);
      setStart([NaN, NaN]);
      setStartIndex(-1);
      setIndex(-1);
      setIsUpdating(false);
    });
  }, [index, isUpdating, onUpdate, startIndex]);

  const onMouseDown = useDragElement({
    onStartDragging,
    onDragging,
    onStopDragging,
  });

  useEffect(() => {
    if (element && shouldReset) {
      element.style.transform = "";
    }
  }, [shouldReset, element]);

  useEffect(() => {
    if (!element) return;

    const canMove = !isNaN(x) && !isNaN(y) && !isNaN(startX) && !isNaN(startY);

    if (canMove && !shouldReset) {
      const deltaX = x - startX;
      const deltaY = y - startY;

      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      element.style.pointerEvents = "none";
    } else {
      element.style.transform = "";
      element.style.pointerEvents = "";
    }
  }, [x, y, startX, startY, element, shouldReset]);

  useEffect(() => {
    if (!containerRef.current || !element) return;

    if (x && y) {
      const underCursor = document.elementFromPoint(x, y);

      if (!underCursor) return;

      const newItem = firstAncestor(underCursor, isDragItem);

      if (newItem) {
        const children = [...containerRef.current.children];

        setIndex(children.findIndex((child) => child === newItem));
      } else {
        const outsideContainer = !firstAncestor(underCursor, isDragContainer);

        if (outsideContainer) setIndex(-1);
      }
    }
  }, [x, y, element]);

  useEffect(
    () =>
      stylizeInsertionPoint(
        theme,
        containerRef?.current?.children,
        startIndex,
        index
      ),
    [index, startIndex, theme]
  );

  return (
    <Stack ref={containerRef} direction="column" className="drag-container">
      {children.map((child, i) => (
        <Stack
          style={{
            userSelect: "none",
            borderBottom: "2px solid transparent",
            borderTop: "2px solid transparent",
          }}
          sx={{
            ["> *"]: {
              cursor: disabled ? undefined : element ? "grabbing" : "grab",
            },
          }}
          className="drag-item"
          onMouseDown={!disabled ? onMouseDown : undefined}
          direction="row"
          key={i}
        >
          {child}
        </Stack>
      ))}
    </Stack>
  );
};

const stylizeInsertionPoint = (
  theme: Theme,
  children: HTMLCollection | undefined,
  startIndex: number,
  currentIndex: number
) => {
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (!(child instanceof HTMLElement)) return;

    if (i === currentIndex) {
      child.style[i < startIndex ? "borderTopColor" : "borderBottomColor"] =
        theme.palette.primary.main;
      child.style.opacity = "0.4";
    } else {
      child.style.borderTopColor = "transparent";
      child.style.borderBottomColor = "transparent";
      child.style.opacity = "1";
    }
  }
};
