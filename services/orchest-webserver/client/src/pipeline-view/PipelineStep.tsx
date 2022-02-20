import { PipelineStepState, PipelineStepStatus } from "@/types";
import classNames from "classnames";
import React from "react";
import { EventVarsAction } from "./useEventVars";

export const STEP_WIDTH = 190;
export const STEP_HEIGHT = 105;

export type ExecutionState = {
  finished_time?: Date;
  server_time?: Date;
  started_time?: Date;
  status: PipelineStepStatus;
};
export interface IPipelineStepProps {
  selected?: boolean;
  step?: PipelineStepState;
  isCreatingConnection: boolean;
  onMouseUp: (endNodeUUID: string) => void;
  executionState?: ExecutionState;
  eventVarsDispatch: (value: EventVarsAction) => void;
  // TODO: clean up these
  onClick: any;
  onDoubleClick: any;
}

const PipelineStep = (
  {
    step,
    executionState,
    selected,
    onMouseUp,
    isCreatingConnection,
    eventVarsDispatch,
    ...props
  }: IPipelineStepProps,
  ref: React.MutableRefObject<HTMLDivElement>
) => {
  const formatSeconds = (seconds: number) => {
    // Hours, minutes and seconds
    let hrs = ~~(seconds / 3600);
    let mins = ~~((seconds % 3600) / 60);
    let secs = ~~seconds % 60;

    let ret = "";
    if (hrs > 0) {
      ret += hrs + "h ";
    }
    if (mins > 0) {
      ret += mins + "m ";
    }
    ret += secs + "s";
    return ret;
  };

  let stateText = "Ready";

  if (executionState.status === "SUCCESS") {
    let seconds = Math.round(
      (executionState.finished_time.getTime() -
        executionState.started_time.getTime()) /
        1000
    );

    stateText = "Completed (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "FAILURE") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.finished_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Failure (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "STARTED") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.server_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Running (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status == "PENDING") {
    stateText = "Pending";
  }
  if (executionState.status == "ABORTED") {
    stateText = "Aborted";
  }

  const [x, y] = step.meta_data.position;
  const style = { transform: `translateX(${x}px) translateY(${y}px)` };

  const onMouseDown = () => {
    eventVarsDispatch({ type: "SELECT_SINGLE_STEP", payload: step.uuid });
  };

  return (
    <div
      data-uuid={step.uuid}
      data-test-title={step.title}
      data-test-id={"pipeline-step"}
      ref={ref}
      className={[
        "pipeline-step",
        executionState.status,
        selected && "selected",
        step.meta_data?.hidden && "hidden",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onMouseDown={onMouseDown}
    >
      <div
        className={classNames(
          "incoming-connections connection-point",
          isCreatingConnection ? "hover" : ""
        )}
        onMouseUp={() => onMouseUp(step.uuid)}
      >
        <div className="inner-dot"></div>
      </div>
      <div className={"execution-indicator"}>
        {{
          SUCCESS: <span className="success">✓ </span>,
          FAILURE: <span className="failure">✗ </span>,
          ABORTED: <span className="aborted">❗ </span>,
        }[executionState.status] || null}
        {stateText}
      </div>
      <div className="step-label-holder">
        <div className={"step-label"}>
          {step.title}
          <span className="filename">{step.file_path}</span>
        </div>
      </div>
      <div className={"outgoing-connections connection-point"}>
        <div className="inner-dot"></div>
      </div>
    </div>
  );
};

export default React.forwardRef(PipelineStep);
