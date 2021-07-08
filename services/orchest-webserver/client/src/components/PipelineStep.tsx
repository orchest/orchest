import * as React from "react";
import { RefManager } from "@orchest/lib-utils";

export type TPipelineStepRef = any;
export interface IPipelineStepProps {
  selected?: boolean;
  step?: any;
  executionState?: {
    finished_time: number;
    server_time: number;
    started_time: number;
    status: "STARTED" | "SUCCESS" | "FAILURE" | "ABORTED" | "PENDING";
  };
}

const PipelineStep = React.forwardRef<TPipelineStepRef, IPipelineStepProps>(
  (props, ref) => {
    const [refManager] = React.useState(new RefManager());

    const updatePosition = (position) => {
      // note: DOM update outside of normal React loop for performance
      refManager.refs.container.style.transform =
        "translateX(" + position[0] + "px) translateY(" + position[1] + "px)";
    };

    const formatSeconds = (seconds) => {
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

    React.useEffect(() => updatePosition(props.step.meta_data.position), []);

    React.useImperativeHandle(ref, () => ({
      updatePosition,
      props,
      refManager,
    }));

    let stateText = "Ready";

    if (props.executionState.status === "SUCCESS") {
      let seconds = Math.round(
        (props.executionState.finished_time -
          props.executionState.started_time) /
          1000
      );

      stateText = "Completed (" + formatSeconds(seconds) + ")";
    }
    if (props.executionState.status === "FAILURE") {
      let seconds = 0;

      if (props.executionState.started_time !== undefined) {
        seconds = Math.round(
          (props.executionState.finished_time -
            props.executionState.started_time) /
            1000
        );
      }

      stateText = "Failure (" + formatSeconds(seconds) + ")";
    }
    if (props.executionState.status === "STARTED") {
      let seconds = 0;

      if (props.executionState.started_time !== undefined) {
        seconds = Math.round(
          (props.executionState.server_time -
            props.executionState.started_time) /
            1000
        );
      }

      stateText = "Running (" + formatSeconds(seconds) + ")";
    }
    if (props.executionState.status == "PENDING") {
      stateText = "Pending";
    }
    if (props.executionState.status == "ABORTED") {
      stateText = "Aborted";
    }

    return (
      <div
        data-uuid={props.step.uuid}
        ref={refManager.nrefs.container}
        className={[
          "pipeline-step",
          props.executionState.status,
          props.selected && "selected",
          props.step &&
            props.step["meta_data"] &&
            props.step["meta_data"]["hidden"] === true &&
            "hidden",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={"incoming-connections connection-point"}>
          <div className="inner-dot"></div>
        </div>
        <div className={"execution-indicator"}>
          {{
            SUCCESS: <span className="success">✓ </span>,
            FAILURE: <span className="failure">✗ </span>,
            ABORTED: <span className="aborted">❗ </span>,
          }[props.executionState.status] || null}
          {stateText}
        </div>
        <div className="step-label-holder">
          <div className={"step-label"}>
            {props.step.title}
            <span className="filename">{props.step.file_path}</span>
          </div>
        </div>
        <div className={"outgoing-connections connection-point"}>
          <div className="inner-dot"></div>
        </div>
      </div>
    );
  }
);

export default PipelineStep;
