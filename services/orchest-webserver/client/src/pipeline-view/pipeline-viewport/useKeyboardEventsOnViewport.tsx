import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { CanvasFunctions } from "./PipelineViewport";

export const useKeyboardEventsOnViewport = (
  canvasFuncRef: React.MutableRefObject<CanvasFunctions | undefined>
) => {
  const { dispatch, keysDown } = usePipelineEditorContext();
  const { setPipelineCanvasState } = usePipelineCanvasContext();
  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;

      if (event.key === " " && !keysDown.has("Space")) {
        // if any element is on focus, pressing space bar is equivalent to mouse click
        // therefore it's needed to remove all "focus" state
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setPipelineCanvasState({ panningState: "ready-to-pan" });
        keysDown.add("Space");
      }
      if (canvasFuncRef.current && event.key === "h" && !keysDown.has("h")) {
        canvasFuncRef.current.centerView();
        keysDown.add("h");
      }
    };
    const keyUpHandler = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPipelineCanvasState({ panningState: "idle" });
        keysDown.delete("Space");
      }
      if (event.key === "h") {
        keysDown.delete("h");
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);
    document.body.addEventListener("keyup", keyUpHandler);
    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
      document.body.removeEventListener("keyup", keyUpHandler);
    };
  }, [dispatch, keysDown, canvasFuncRef, setPipelineCanvasState]);
};
