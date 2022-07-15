import { useHotKeys } from "@/hooks/useHotKeys";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useRunSteps } from "../pipeline-canvas-header-bar/pipeline-operations/useRunSteps";

const COMMANDS = {
  SELECT_ALL: ["ctrl+a", "command+a"],
  RUN_ALL: ["ctrl+shift+enter", "command+shift+enter"],
  RUN_SELECTED: ["ctrl+enter", "command+enter"],
  RUN_INCOMING: ["ctrl+i", "command+i"],
  SCHEDULE_JOB: ["ctrl+j", "command+j"],
};

const commandsString = Object.values(COMMANDS).join(", ");

export const useHotKeysInPipelineEditor = () => {
  const { eventVars, dispatch } = usePipelineEditorContext();
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

  return { enableHotKeys, disableHotKeys };
};
