import {
  ContextMenu,
  ContextMenuContextProvider,
  ContextMenuItem,
  useContextMenuContext,
} from "@/components/ContextMenu";
import React from "react";
import { useInteractiveRunsContext } from "./contexts/InteractiveRunsContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useOpenFile } from "./hooks/useOpenFile";

type PipelineStepContextMenuProps = { stepUuid: string };

export const PipelineStepContextMenuProvider = ContextMenuContextProvider;

export const usePipelineStepContextMenu = useContextMenuContext;

export const PipelineStepContextMenu = ({
  stepUuid,
}: PipelineStepContextMenuProps) => {
  const { handleContextMenu, ...props } = usePipelineStepContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { executeRun } = useInteractiveRunsContext();
  const { isReadOnly } = usePipelineDataContext();
  const {
    uiState: { steps, selectedSteps },
    uiStateDispatch,
  } = usePipelineUiStateContext();

  const selectionContainsNotebooks = React.useMemo(
    () =>
      selectedSteps
        .map((s) => steps[s])
        .filter((step) => step.file_path.endsWith(".ipynb")).length > 0,
    [selectedSteps, steps]
  );

  const { openNotebook, openFilePreviewView } = useOpenFile();

  const menuItems: ContextMenuItem[] = [
    {
      type: "item",
      title: "Duplicate",
      disabled: isReadOnly || selectionContainsNotebooks,
      action: () => {
        uiStateDispatch({ type: "DUPLICATE_STEPS", payload: [stepUuid] });
      },
    },
    {
      type: "item",
      title: "Delete",
      disabled: isReadOnly,
      action: () => {
        uiStateDispatch({ type: "REMOVE_STEPS", payload: selectedSteps });
      },
    },
    {
      type: "item",
      title: "Properties",
      action: () => {
        uiStateDispatch({ type: "OPEN_STEP_DETAILS" });
      },
    },
    {
      type: "item",
      title: "Open in JupyterLab",
      disabled: isReadOnly,
      action: ({ event }) => {
        uiStateDispatch({ type: "SET_OPENED_STEP", payload: stepUuid });
        openNotebook(event, stepUuid);
      },
    },
    {
      type: "item",
      title: "Open in File Viewer",
      action: ({ event }) => {
        openFilePreviewView(event, stepUuid);
      },
    },
    {
      type: "separator",
    },
    {
      type: "item",
      title: "Run this step",
      disabled: isReadOnly,
      action: () => {
        executeRun([stepUuid], "selection");
      },
    },
    {
      type: "item",
      title: "Run incoming",
      disabled: isReadOnly,
      action: () => {
        executeRun([stepUuid], "incoming");
      },
    },
  ];
  return props.position ? (
    <ContextMenu {...props} menuItems={menuItems} />
  ) : null;
};
