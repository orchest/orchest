import React from "react";
import { MDCButtonReact, MDCSwitchReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { getCurrentSession, OrchestContext } from "@/lib/orchest";

class SessionToggleButton extends React.Component {
  static contextType = OrchestContext;

  constructor(props, context) {
    super(props, context);

    this.promiseManager = new PromiseManager();
    this.STATUS_POLL_FREQUENCY = 1000;
  }

  onClick(e) {
    e.stopPropagation();
  }

  componentWillUnmount() {
    // this.context.dispatch({ type: "sessionCancelPromises" });
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    if (this.props.fetchOnInit) {
      this.context.dispatch({ type: "sessionFetch" });
    }
  }

  getPowerButtonClasses() {
    const currentSession = getCurrentSession(this.context.state);

    let classes = ["mdc-button--outlined", "session-state-button"];

    if (currentSession?.status === "RUNNING") {
      classes.push("active");
    }

    if (currentSession?.status === "LAUNCHING") {
      classes.push("working");
    }

    return classes;
  }

  render() {
    const currentSession = getCurrentSession(this.context.state);

    const label =
      {
        STOPPING: "Session stopping…",
        STARTING: "Session starting…",
        RUNNING: "Stop session",
      }[currentSession?.status] || "Start session";

    let classes = [];
    if (this.props.classNames) {
      classes = classes.concat(this.props.classNames);
    }

    // This component can be rendered as a switch or button
    if (this.props.switch === true) {
      return (
        <MDCSwitchReact
          classNames={classes.join(" ")}
          disabled={["STOPPING", "LAUNCHING"].includes(currentSession?.status)}
          on={currentSession?.status === "RUNNING"}
          onChange={(e) => {
            e.preventDefault();
            this.context.dispatch({ type: "sessionToggle" });
          }}
          label={label}
        />
      );
    } else {
      classes = classes.concat(this.getPowerButtonClasses());
      return (
        <MDCButtonReact
          onClick={(e) => {
            e.preventDefault();
            /// temporary
            // this.context.dispatch({ type: "sessionFetch" });
            this.context.dispatch({ type: "sessionToggle" });
          }}
          classNames={classes.join(" ")}
          label={label}
          disabled={["STOPPING", "LAUNCHING"].includes(currentSession?.status)}
          icon={currentSession?.status === "RUNNING" ? "stop" : "play_arrow"}
        />
      );
    }
  }
}

export default SessionToggleButton;
