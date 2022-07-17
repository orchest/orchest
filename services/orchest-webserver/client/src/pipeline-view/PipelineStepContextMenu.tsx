import {
  ContextMenu,
  ContextMenuContextProvider,
  ContextMenuItem,
  useContextMenuContext,
} from "@/components/ContextMenu";
import React from "react";
import { useInteractiveRunsContext } from "./contexts/InteractiveRunsContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { usePipelineUiParamsContext } from "./contexts/PipelineUiParamsContext";
import { useOpenFile } from "./hooks/useOpenFile";

type PipelineStepContextMenuProps = { stepUuid: string };

export const PipelineStepContextMenuProvider = ContextMenuContextProvider;

export const usePipelineStepContextMenu = useContextMenuContext;

export const PipelineStepContextMenu = ({
  stepUuid,
}: PipelineStepContextMenuProps) => {
  const { handleContextMenu, ...props } = usePipelineStepContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { executeRun } = useInteractiveRunsContext();
  const {
    dispatch,
    eventVars: { steps, selectedSteps },
  } = usePipelineEditorContext();
  const { isReadOnly } = usePipelineDataContext();
  const { uiParamsDispatch } = usePipelineUiParamsContext();

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
        dispatch({ type: "DUPLICATE_STEPS", payload: [stepUuid] });
      },
    },
    {
      type: "item",
      title: "Delete",
      disabled: isReadOnly,
      action: () => {
        dispatch({ type: "REMOVE_STEPS", payload: selectedSteps });
      },
    },
    {
      type: "item",
      title: "Properties",
      action: () => {
        uiParamsDispatch({ type: "OPEN_STEP_DETAILS" });
      },
    },
    {
      type: "item",
      title: "Open in JupyterLab",
      disabled: isReadOnly,
      action: ({ event }) => {
        dispatch({ type: "SET_OPENED_STEP", payload: stepUuid });
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
