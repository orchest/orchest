// @ts-check
// @TODO - Functional Component Transformation (then remove lines 1-2)
//         https://github.com/orchest/orchest/issues/259
import React from "react";
import { RefManager } from "@orchest/lib-utils";

class PipelineStep extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.updatePosition(this.props.step.meta_data.position);
  }

  updatePosition(position) {
    // note: DOM update outside of normal React loop for performance
    this.refManager.refs.container.style.transform =
      "translateX(" + position[0] + "px) translateY(" + position[1] + "px)";
  }

  formatSeconds(seconds) {
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
  }

  render() {
    let classNames = ["pipeline-step"];

    if (this.props.selected) {
      classNames.push("selected");
    }

    let stateText = "Ready";

    classNames.push(this.props.executionState.status);

    if (this.props.executionState.status === "SUCCESS") {
      let seconds = Math.round(
        (this.props.executionState.finished_time -
          this.props.executionState.started_time) /
          1000
      );

      stateText = "Completed (" + this.formatSeconds(seconds) + ")";
    }
    if (this.props.executionState.status === "FAILURE") {
      let seconds = 0;

      if (this.props.executionState.started_time !== undefined) {
        seconds = Math.round(
          (this.props.executionState.finished_time -
            this.props.executionState.started_time) /
            1000
        );
      }

      stateText = "Failure (" + this.formatSeconds(seconds) + ")";
    }
    if (this.props.executionState.status === "STARTED") {
      let seconds = 0;

      if (this.props.executionState.started_time !== undefined) {
        seconds = Math.round(
          (this.props.executionState.server_time -
            this.props.executionState.started_time) /
            1000
        );
      }

      stateText = "Running (" + this.formatSeconds(seconds) + ")";
    }
    if (this.props.executionState.status == "PENDING") {
      stateText = "Pending";
    }
    if (this.props.executionState.status == "ABORTED") {
      stateText = "Aborted";
    }

    if (
      this.props.step &&
      this.props.step["meta_data"] &&
      this.props.step["meta_data"]["hidden"] === true
    ) {
      classNames.push("hidden");
    }

    return (
      <div
        data-uuid={this.props.step.uuid}
        ref={this.refManager.nrefs.container}
        className={classNames.join(" ")}
      >
        <div className={"incoming-connections connection-point"}>
          <div className="inner-dot"></div>
        </div>
        <div className={"execution-indicator"}>
          {(() => {
            if (this.props.executionState.status === "SUCCESS") {
              return <span className="success">✓ </span>;
            }
          })()}
          {(() => {
            if (this.props.executionState.status === "FAILURE") {
              return <span className="failure">✗ </span>;
            }
          })()}
          {(() => {
            if (this.props.executionState.status === "ABORTED") {
              return <span className="aborted">❗ </span>;
            }
          })()}
          {stateText}
        </div>
        <div className="step-label-holder">
          <div className={"step-label"}>
            {this.props.step.title}
            <span className="filename">{this.props.step.file_path}</span>
          </div>
        </div>
        <div className={"outgoing-connections connection-point"}>
          <div className="inner-dot"></div>
        </div>
      </div>
    );
  }
}

export default PipelineStep;
