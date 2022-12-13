import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import {
  ContextMenu,
  ContextMenuContextProvider,
  ContextMenuItem,
  useContextMenuContext,
} from "@/components/ContextMenu";
import { subtractPoints } from "@/utils/geometry";
import { stepPathToProjectPath } from "@/utils/pipeline";
import red from "@mui/material/colors/red";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { SCALE_UNIT, useCanvasScaling } from "../contexts/CanvasScalingContext";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useDeleteSteps } from "../hooks/useDeleteSteps";
import { useInteractiveRuns } from "../hooks/useInteractiveRuns";
import { useOpenFile } from "../hooks/useOpenFile";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

export const PipelineViewportContextMenuProvider = ContextMenuContextProvider;

export const usePipelineViewportContextMenu = useContextMenuContext;

export const PipelineViewportContextMenu = () => {
  const { position, ...props } = usePipelineViewportContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { isReadOnly, pipelineCwd } = usePipelineDataContext();
  const environments = useEnvironmentsApi((state) => state.environments || []);

  const { canvasPointAtPointer } = useCanvasScaling();
  const {
    uiState: { steps, selectedSteps, contextMenuUuid },
    autoLayoutPipeline,
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const { startRun } = useInteractiveRuns();
  const { centerView, zoomBy } = usePipelineCanvasContext();

  const { deleteSelectedSteps } = useDeleteSteps();

  const selectionContainsNotebooks = React.useMemo(() => {
    return (
      selectedSteps
        .map((uuid) => steps[uuid])
        .filter((step) => step.file_path.endsWith(".ipynb")).length > 0
    );
  }, [selectedSteps, steps]);

  const { openNotebook, previewFile } = useOpenFile();

  const previewStepFile = (stepUuid: string, event: React.MouseEvent) => {
    const step = steps[stepUuid];

    if (!step || !pipelineCwd) return;

    previewFile(stepPathToProjectPath(step.file_path, pipelineCwd), event);
  };

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
              const canvasPosition = subtractPoints(canvasPointAtPointer(), [
                STEP_WIDTH / 2,
                STEP_HEIGHT / 2,
              ]);
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
              startRun(selectedSteps, "selection");
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
              zoomBy(position, SCALE_UNIT);
            },
          },
          {
            type: "item",
            title: "Zoom out",
            action: ({ position }) => {
              zoomBy(position, -SCALE_UNIT);
            },
          },
        ]
      : [
          {
            type: "item",
            title: "Edit in JupyterLab",
            disabled: isReadOnly,
            action: ({ event }) => {
              uiStateDispatch({
                type: "SET_OPENED_STEP",
                payload: contextMenuUuid,
              });
              openNotebook(contextMenuUuid, event);
            },
          },
          {
            type: "item",
            title: "File Preview",
            action: ({ event }) => {
              previewStepFile(contextMenuUuid, event);
            },
          },
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
            color: red[500],
            disabled: isReadOnly,
            action: deleteSelectedSteps,
          },
          {
            type: "separator",
          },
          {
            type: "item",
            title: "Run this step",
            disabled: isReadOnly,
            action: () => {
              startRun([contextMenuUuid], "selection");
            },
          },
          {
            type: "item",
            title: "Run incoming",
            disabled:
              isReadOnly ||
              selectedSteps.every(
                (uuid) => steps[uuid].incoming_connections.length === 0
              ),
            action: () => {
              startRun([contextMenuUuid], "incoming");
            },
          },
        ];
  return position ? (
    <ContextMenu {...props} position={position} menuItems={menuItems} />
  ) : null;
};
