import {
  ContextMenu,
  ContextMenuContextProvider,
  ContextMenuItem,
  useContextMenuContext,
} from "@/components/ContextMenu";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { SCALE_UNIT } from "../common";
import { useInteractiveRunsContext } from "../contexts/InteractiveRunsContext";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { usePipelineUiParamsContext } from "../contexts/PipelineUiParamsContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

type PipelineViewportContextMenuProps = { autoLayoutPipeline: () => void };

export const PipelineViewportContextMenuProvider = ContextMenuContextProvider;

export const usePipelineViewportContextMenu = useContextMenuContext;

export const PipelineViewportContextMenu = ({
  autoLayoutPipeline,
}: PipelineViewportContextMenuProps) => {
  const { handleContextMenu, ...props } = usePipelineViewportContextMenu(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const { isReadOnly, environments } = usePipelineDataContext();
  const { getOnCanvasPosition } = usePipelineUiParamsContext();
  const { eventVars, dispatch } = usePipelineEditorContext();
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
        dispatch(createStepAction(environment, canvasPosition));
      },
    },
    {
      type: "item",
      title: "Select all steps",
      disabled: isReadOnly,
      action: () => {
        dispatch({
          type: "SELECT_STEPS",
          payload: { uuids: Object.keys(eventVars.steps) },
        });
      },
    },
    {
      type: "item",
      title: "Run selected steps",
      disabled: isReadOnly || eventVars.selectedSteps.length === 0,
      action: () => {
        executeRun(eventVars.selectedSteps, "selection");
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
