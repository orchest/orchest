import {
  ContextMenu,
  ContextMenuContextProvider,
  ContextMenuItem,
  useContextMenuContext,
} from "@/components/ContextMenu";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { SCALE_UNIT, useScaleFactor } from "../contexts/ScaleFactorContext";
import { useDeleteSteps } from "../hooks/useDeleteSteps";
import { useOpenFile } from "../hooks/useOpenFile";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

export const PipelineViewportContextMenuProvider = ContextMenuContextProvider;

export const usePipelineViewportContextMenu = useContextMenuContext;

export const PipelineViewportContextMenu = () => {
  const { handleContextMenu, ...props } = usePipelineViewportContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { isReadOnly, environments } = usePipelineDataContext();
  const { getOnCanvasPosition } = useScaleFactor();
  const {
    uiState: { steps, selectedSteps, contextMenuUuid },
    autoLayoutPipeline,
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const { executeRun } = useInteractiveRunsContext();
  const { centerView, zoom } = usePipelineCanvasContext();

  const { deleteSelectedSteps } = useDeleteSteps();

  const selectionContainsNotebooks = React.useMemo(() => {
    return (
      selectedSteps
        .map((s) => steps[s])
        .filter((step) => step.file_path.endsWith(".ipynb")).length > 0
    );
  }, [selectedSteps, steps]);

  const { openNotebook, openFilePreviewView } = useOpenFile();

  if (!contextMenuUuid) return null;

  const menuItems: ContextMenuItem[] =
    contextMenuUuid === "viewport"
      ? [
          {
            type: "item",
            title: "Create new step",
            disabled: isReadOnly,
            action: () => {
              const environment =
                environments.length > 0 ? environments[0] : null;
              const canvasPosition = getOnCanvasPosition({
                x: STEP_WIDTH / 2,
                y: STEP_HEIGHT / 2,
              });
              uiStateDispatch(createStepAction(environment, canvasPosition));
            },
          },
          {
            type: "item",
            title: "Select all steps",
            disabled: isReadOnly,
            action: () => {
              uiStateDispatch({
                type: "SELECT_STEPS",
                payload: { uuids: Object.keys(steps) },
              });
            },
          },
          {
            type: "item",
            title: "Run selected steps",
            disabled: isReadOnly || selectedSteps.length === 0,
            action: () => {
              executeRun(selectedSteps, "selection");
            },
          },
          {
            type: "separator",
          },
          {
            type: "item",
            title: "Zoom to fit",
            action: () => {
              centerView();
            },
          },
          {
            type: "item",
            title: "Auto layout pipeline",
            disabled: isReadOnly,
            action: () => {
              autoLayoutPipeline();
            },
          },
          {
            type: "item",
            title: "Zoom in",
            action: ({ position }) => {
              zoom(position, SCALE_UNIT);
            },
          },
          {
            type: "item",
            title: "Zoom out",
            action: ({ position }) => {
              zoom(position, -SCALE_UNIT);
            },
          },
        ]
      : [
          {
            type: "item",
            title: "Duplicate",
            disabled: isReadOnly || selectionContainsNotebooks,
            action: () => {
              uiStateDispatch({
                type: "DUPLICATE_STEPS",
                payload: [contextMenuUuid],
              });
            },
          },
          {
            type: "item",
            title: "Delete",
            disabled: isReadOnly,
            action: deleteSelectedSteps,
          },
          {
            type: "item",
            title: "Properties",
            action: () => {
              uiStateDispatch({
                type: "SELECT_STEPS",
                payload: { uuids: [contextMenuUuid] },
              });
            },
          },
          {
            type: "item",
            title: "Open in JupyterLab",
            disabled: isReadOnly,
            action: ({ event }) => {
              uiStateDispatch({
                type: "SET_OPENED_STEP",
                payload: contextMenuUuid,
              });
              openNotebook(event, contextMenuUuid);
            },
          },
          {
            type: "item",
            title: "Open in File Viewer",
            action: ({ event }) => {
              openFilePreviewView(event, contextMenuUuid);
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
              executeRun([contextMenuUuid], "selection");
            },
          },
          {
            type: "item",
            title: "Run incoming",
            disabled: isReadOnly,
            action: () => {
              executeRun([contextMenuUuid], "incoming");
            },
          },
        ];
  return props.position ? (
    <ContextMenu {...props} menuItems={menuItems} />
  ) : null;
};
