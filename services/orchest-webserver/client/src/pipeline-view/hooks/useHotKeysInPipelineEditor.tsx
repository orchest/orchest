import { useHotKeys } from "@/hooks/useHotKeys";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { usePipelineActions } from "../pipeline-canvas-header-bar/primary-action/usePipelineActions";
import { useDeleteSteps } from "./useDeleteSteps";

const COMMANDS = {
  RUN_ALL: ["ctrl+shift+enter", "command+shift+enter"],
  RUN_SELECTED: ["ctrl+enter", "command+enter"],
  RUN_INCOMING: ["ctrl+i", "command+i"],
  SCHEDULE_JOB: ["ctrl+j", "command+j"],
  CENTER_VIEW: ["h"],
  ZOOM_IN: ["ctrl+up", "command+up"],
  ZOOM_OUT: ["ctrl+down", "command+down"],
  AUTO_LAYOUT: ["ctrl+shift+o", "command+shift+o"],
};

const IN_CANVAS_COMMANDS = {
  SELECT_ALL: ["ctrl+a", "command+a"],
};

const commandsString = Object.values(COMMANDS).join(", ");
const inCanvasCommandsString = Object.values(IN_CANVAS_COMMANDS).join(", ");

export const useHotKeysInPipelineEditor = () => {
  const { isReadOnly } = usePipelineDataContext();
  const {
    centerView,
    centerPipelineOrigin,
    zoomIn,
    zoomOut,
  } = usePipelineCanvasContext();
  const {
    uiStateDispatch,
    uiState: { stepSelector, steps, selectedSteps, selectedConnection },
    autoLayoutPipeline,
  } = usePipelineUiStateContext();
  const [isHoverEditor, setIsHoverEditor] = React.useState(false);
  const {
    runAllSteps,
    runSelectedSteps,
    runIncomingSteps,
    createDraftJob,
  } = usePipelineActions();

  useHotKeys(
    {
      all: {
        [commandsString]: (e, hotKeyEvent) => {
          if (COMMANDS.RUN_ALL.includes(hotKeyEvent.key)) {
            runAllSteps?.();
          }
          if (COMMANDS.RUN_SELECTED.includes(hotKeyEvent.key)) {
            runSelectedSteps?.();
          }
          if (COMMANDS.RUN_INCOMING.includes(hotKeyEvent.key)) {
            runIncomingSteps?.();
          }
          if (COMMANDS.SCHEDULE_JOB.includes(hotKeyEvent.key)) {
            createDraftJob?.();
          }
          if (COMMANDS.CENTER_VIEW.includes(hotKeyEvent.key)) {
            centerView();
          }
          if (COMMANDS.ZOOM_IN.includes(hotKeyEvent.key)) {
            zoomIn();
          }
          if (COMMANDS.ZOOM_OUT.includes(hotKeyEvent.key)) {
            zoomOut();
          }
          if (COMMANDS.AUTO_LAYOUT.includes(hotKeyEvent.key)) {
            autoLayoutPipeline();
          }
        },
      },
    },
    [
      runAllSteps,
      runSelectedSteps,
      runIncomingSteps,
      createDraftJob,
      centerView,
      centerPipelineOrigin,
      autoLayoutPipeline,
    ]
  );

  const { setScope } = useHotKeys(
    {
      "pipeline-editor": {
        [inCanvasCommandsString]: (e, hotKeyEvent) => {
          const isEditingText =
            document.activeElement?.tagName === "INPUT" ||
            document.activeElement?.tagName === "TEXTAREA";

          if (
            IN_CANVAS_COMMANDS.SELECT_ALL.includes(hotKeyEvent.key) &&
            !isEditingText
          ) {
            e.preventDefault();

            uiStateDispatch({
              type: "SELECT_STEPS",
              payload: { uuids: Object.keys(steps) },
            });
          }
        },
      },
    },
    [isHoverEditor, steps],
    isHoverEditor
  );

  const enableHotKeys = () => {
    setScope("pipeline-editor");
    setIsHoverEditor(true);
  };

  const disableHotKeys = () => {
    setIsHoverEditor(false);
  };

  React.useEffect(() => {
    disableHotKeys();
    return () => disableHotKeys();
  }, []);
  const { deleteSelectedSteps } = useDeleteSteps();

  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;
      if (stepSelector.active) {
        uiStateDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
      }

      if (
        !isReadOnly &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        if (selectedSteps.length > 0) deleteSelectedSteps();
        if (selectedConnection)
          uiStateDispatch({
            type: "REMOVE_CONNECTION",
            payload: selectedConnection,
          });
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);

    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
    };
  }, [
    uiStateDispatch,
    isReadOnly,
    selectedConnection,
    selectedSteps,
    stepSelector.active,
    deleteSelectedSteps,
  ]);

  return { enableHotKeys, disableHotKeys };
};
