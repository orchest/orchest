import { useHotKeys } from "@/hooks/useHotKeys";
import { activeElementIsInput } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { usePipelineUiStatesContext } from "../contexts/PipelineUiStatesContext";
import { useRunSteps } from "../pipeline-canvas-header-bar/pipeline-operations/useRunSteps";
import { useDeleteSteps } from "./useDeleteSteps";

const COMMANDS = {
  SELECT_ALL: ["ctrl+a", "command+a"],
  RUN_ALL: ["ctrl+shift+enter", "command+shift+enter"],
  RUN_SELECTED: ["ctrl+enter", "command+enter"],
  RUN_INCOMING: ["ctrl+i", "command+i"],
  SCHEDULE_JOB: ["ctrl+j", "command+j"],
  ZOOM_IN: ["ctrl++", "command++"],
  ZOOM_OUT: ["ctrl+-", "command+-"],
  CENTER_VIEW: ["h"],
  AUTO_LAYOUT: ["ctrl+shift+l", "command+shift+l"],
};

const commandsString = Object.values(COMMANDS).join(", ");

export const useHotKeysInPipelineEditor = () => {
  const { eventVars, dispatch } = usePipelineEditorContext();
  const { isReadOnly } = usePipelineDataContext();
  const {
    uiStatesDispatch,
    uiStates: { stepSelector },
  } = usePipelineUiStatesContext();
  const [isHoverEditor, setIsHoverEditor] = React.useState(false);
  const {
    runAllSteps,
    runSelectedSteps,
    runIncomingSteps,
    scheduleJob,
  } = useRunSteps();

  const { setScope } = useHotKeys(
    {
      "pipeline-editor": {
        [commandsString]: (e, hotKeyEvent) => {
          if (COMMANDS.SELECT_ALL.includes(hotKeyEvent.key)) {
            e.preventDefault();

            dispatch({
              type: "SELECT_STEPS",
              payload: { uuids: Object.keys(eventVars.steps) },
            });
          }
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
            scheduleJob?.();
          }
        },
      },
    },
    [isHoverEditor, eventVars.steps, eventVars.selectedSteps],
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
        uiStatesDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
      }

      if (
        !isReadOnly &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        if (eventVars.selectedSteps.length > 0) deleteSelectedSteps();
        if (eventVars.selectedConnection)
          dispatch({
            type: "REMOVE_CONNECTION",
            payload: eventVars.selectedConnection,
          });
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);

    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
    };
  }, [
    dispatch,
    isReadOnly,
    eventVars.selectedConnection,
    eventVars.selectedSteps,
    stepSelector.active,
    deleteSelectedSteps,
    uiStatesDispatch,
  ]);

  return { enableHotKeys, disableHotKeys };
};
