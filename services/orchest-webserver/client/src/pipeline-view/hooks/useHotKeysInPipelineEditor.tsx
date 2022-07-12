import { useHotKeys } from "@/hooks/useHotKeys";
import React from "react";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";

export const useHotKeysInPipelineEditor = (isSessionRunning: boolean) => {
  const { eventVars, dispatch } = usePipelineEditorContext();
  const { runSteps } = useInteractiveRunsContext();
  const [isHoverEditor, setIsHoverEditor] = React.useState(false);

  const { setScope } = useHotKeys(
    {
      "pipeline-editor": {
        "ctrl+a, command+a, ctrl+enter, command+enter": (e, hotKeyEvent) => {
          if (["ctrl+a", "command+a"].includes(hotKeyEvent.key)) {
            e.preventDefault();

            dispatch({
              type: "SELECT_STEPS",
              payload: { uuids: Object.keys(eventVars.steps) },
            });
          }
          if (["ctrl+enter", "command+enter"].includes(hotKeyEvent.key)) {
            runSteps(eventVars.selectedSteps, "selection", isSessionRunning);
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
