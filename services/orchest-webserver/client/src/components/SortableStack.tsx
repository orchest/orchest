import { useDragElement } from "@/hooks/useDragElement";
import { firstAncestor } from "@/utils/element";
import { Stack, useTheme } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";

export interface SortableStackProps {
  onUpdate: (oldIndex: number, newIndex: number) => Promise<void>;
  children: React.ReactChild[];
  disabled?: boolean;
}

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

  const shouldReset = useMemo(() => y && startY && Math.abs(y - startY) < 10, [
    y,
    startY,
  ]);

  const onStartDragging = React.useCallback(
    (event: React.MouseEvent) => {
      if (isUpdating) return;
      if (!containerRef.current) return;
      const dragging = firstAncestor(event.target as Element, isDragItem);

      if (dragging instanceof HTMLElement) {
        const children = [...containerRef.current.children];

        setStartIndex(children.findIndex((item) => item === dragging));
        setStart([event.pageX, event.pageY]);
        setPosition([event.pageX, event.pageY]);
        setElement(dragging);
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

    if (x && y && startX && startY && !shouldReset) {
      const dx = x - startX;
      const dy = y - startY;

      element.style.transform = `translate(${dx}px, ${dy}px)`;
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

  const theme = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    [...containerRef.current.children].forEach((child, i) => {
      if (!(child instanceof HTMLElement)) return;

      if (i === index) {
        child.style[i < startIndex ? "borderTopColor" : "borderBottomColor"] =
          theme.palette.primary.main;
        child.style.opacity = "0.4";
      } else {
        child.style.borderTopColor = "transparent";
        child.style.borderBottomColor = "transparent";
        child.style.opacity = "1";
      }
    });
  }, [index, startIndex, theme]);

  return (
    <Stack ref={containerRef} direction="column" className="drag-container">
      {children.map((child, i) => (
        <Stack
          style={{
            userSelect: "none",
            borderBottom: "2px solid transparent",
            borderTop: "2px solid transparent",
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