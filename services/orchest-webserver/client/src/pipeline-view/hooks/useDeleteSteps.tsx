import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

const deleteStepMessage =
  "A deleted step and its logs cannot be recovered once deleted, are you sure you want to proceed?";

export const useDeleteSteps = () => {
  const { setConfirm } = useGlobalContext();
  const {
    uiState: { selectedSteps },
    uiStateDispatch,
  } = usePipelineUiStateContext();

  const setIsDeletingSteps = React.useCallback(
    (value: boolean) => {
      uiStateDispatch({ type: "SET_IS_DELETING_STEPS", payload: value });
    },
    [uiStateDispatch]
  );

  const removeSteps = React.useCallback(
    (uuids: string[]) => {
      uiStateDispatch({ type: "REMOVE_STEPS", payload: uuids });
    },
    [uiStateDispatch]
  );

  const deleteSteps = React.useCallback(
    (steps: string[]) => {
      setIsDeletingSteps(true);

      setConfirm("Warning", deleteStepMessage, {
        onConfirm: async (resolve) => {
          uiStateDispatch({ type: "SET_OPENED_STEP", payload: undefined });
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
    [uiStateDispatch, removeSteps, setConfirm, setIsDeletingSteps]
  );

  const deleteSelectedSteps = React.useCallback(() => {
    // The if is to avoid the dialog appearing when no steps are
    // selected and the delete button is pressed.
    if (selectedSteps.length > 0) {
      deleteSteps([...selectedSteps]);
    }
  }, [deleteSteps, selectedSteps]);

  return { deleteSteps, deleteSelectedSteps };
};
