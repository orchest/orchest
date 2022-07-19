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
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

type PipelineViewportContextMenuProps = { autoLayoutPipeline: () => void };

export const PipelineViewportContextMenuProvider = ContextMenuContextProvider;

export const usePipelineViewportContextMenu = useContextMenuContext;

export const PipelineViewportContextMenu = ({
  autoLayoutPipeline,
}: PipelineViewportContextMenuProps) => {
  const { handleContextMenu, ...props } = usePipelineViewportContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { isReadOnly, environments } = usePipelineDataContext();
  const { getOnCanvasPosition } = useScaleFactor();
  const {
    uiState: { steps, selectedSteps },
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const { executeRun } = useInteractiveRunsContext();

  const { centerView, zoom } = usePipelineCanvasContext();

  const menuItems: ContextMenuItem[] = [
    {
      type: "item",
      title: "Create new step",
      disabled: isReadOnly,
      action: () => {
        const environment = environments.length > 0 ? environments[0] : null;
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
      title: "Center view",
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
  ];
  return props.position ? (
    <ContextMenu {...props} menuItems={menuItems} />
  ) : null;
};
