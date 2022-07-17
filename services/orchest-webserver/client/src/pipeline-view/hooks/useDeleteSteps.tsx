import { useAppContext } from "@/contexts/AppContext";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { usePipelineUiStatesContext } from "../contexts/PipelineUiStatesContext";

const deleteStepMessage =
  "A deleted step and its logs cannot be recovered once deleted, are you sure you want to proceed?";

export const useDeleteSteps = () => {
  const { setConfirm } = useAppContext();
  const { uiStatesDispatch } = usePipelineUiStatesContext();
  const { eventVars, dispatch } = usePipelineEditorContext();

  const setIsDeletingSteps = React.useCallback(
    (value: boolean) => {
      uiStatesDispatch({ type: "SET_IS_DELETING_STEPS", payload: value });
    },
    [uiStatesDispatch]
  );

  const removeSteps = React.useCallback(
    (uuids: string[]) => {
      dispatch({ type: "REMOVE_STEPS", payload: uuids });
    },
    [dispatch]
  );

  const deleteSteps = React.useCallback(
    (steps: string[]) => {
      setIsDeletingSteps(true);

      setConfirm("Warning", deleteStepMessage, {
        onConfirm: async (resolve) => {
          dispatch({ type: "SET_OPENED_STEP", payload: undefined });
          removeSteps(steps);
          setIsDeletingSteps(false);
          resolve(true);
          return true;
        },
        onCancel: (resolve) => {
          setIsDeletingSteps(false);
          resolve(false);
          return false;
        },
      });
    },
    [dispatch, removeSteps, setConfirm, setIsDeletingSteps]
  );

  const deleteSelectedSteps = React.useCallback(() => {
    // The if is to avoid the dialog appearing when no steps are
    // selected and the delete button is pressed.
    if (eventVars.selectedSteps.length > 0) {
      deleteSteps([...eventVars.selectedSteps]);
    }
  }, [deleteSteps, eventVars.selectedSteps]);

  return { deleteSteps, deleteSelectedSteps };
};
