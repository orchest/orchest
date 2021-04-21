import React from "react";
import { MDCButtonReact, MDCSwitchReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import { OrchestContext } from "@/lib/orchest";

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
    this.context.dispatch({ type: "sessionCancelPromises" });
    this.promiseManager.cancelCancelablePromises();
    clearInterval(this.sessionPollingInterval);
  }

  componentDidMount() {
    if (this.props.fetchOnInit) {
      this.fetchSessionStatus();
    }
  }

  initializeFetchSessionPolling() {
    clearInterval(this.sessionPollingInterval);

    this.sessionPollingInterval = setInterval(() => {
      this.fetchSessionStatus();
    }, this.STATUS_POLL_FREQUENCY);
  }

  fetchSessionStatus() {
    let fetchSessionPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/sessions/?project_uuid=${this.props.project_uuid}&pipeline_uuid=${this.props.pipeline_uuid}`
      ),
      this.promiseManager
    );

    fetchSessionPromise.promise
      .then((response) => {
        let session_details;

        let result = JSON.parse(response);

        if (result.sessions.length > 0) {
          session_details = result.sessions[0];

          if (session_details.status == "RUNNING") {
            this.setState(
              () => {
                return {
                  working: false,
                  running: true,
                  session_details,
                };
              },
              () => {
                this.props.onSessionStateChange(
                  this.context.state.sessionWorking,
                  this.context.state.sessionRunning,
                  this.context.state.session_details
                );
              }
            );

            clearInterval(this.sessionPollingInterval);
          } else if (session_details.status == "LAUNCHING") {
            this.setState(
              () => {
                return {
                  working: true,
                  running: false,
                };
              },
              () => {
                this.props.onSessionStateChange(
                  this.context.state.sessionWorking,
                  this.context.state.sessionRunning
                );
              }
            );

            this.initializeFetchSessionPolling();
          } else if (session_details.status == "STOPPING") {
            this.setState(
              () => {
                return {
                  working: true,
                  running: true,
                  session_details,
                };
              },
              () => {
                this.initializeFetchSessionPolling();
              }
            );
          }
        } else {
          this.setState(
            () => {
              clearInterval(this.sessionPollingInterval);
              return {
                working: false,
                running: false,
              };
            },
            () => {
              this.props.onSessionStateChange(
                this.context.state.sessionWorking,
                this.context.state.sessionRunning
              );
            }
          );
        }

        this.props.onSessionFetch(session_details);
      })
      .catch((e) => {
        if (!e.isCanceled) {
          console.error(e);
        }
      });
  }

  getPowerButtonClasses() {
    let classes = ["mdc-button--outlined", "session-state-button"];

    if (this.context.state.sessionRunning) {
      classes.push("active");
    }

    if (this.context.state.sessionWorking) {
      classes.push("working");
    }

    return classes;
  }

  render() {
    let label = "Start session";

    if (
      this.context.state.sessionRunning &&
      this.context.state.sessionWorking
    ) {
      label = "Session stopping...";
    } else if (
      !this.context.state.sessionRunning &&
      this.context.state.sessionWorking
    ) {
      label = "Session starting...";
    } else if (
      this.context.state.sessionRunning &&
      !this.context.state.sessionWorking
    ) {
      label = "Stop session";
    }

    let classes = [];
    if (this.props.classNames) {
      classes = classes.concat(this.props.classNames);
    }

    // This component can be rendered as a switch or button
    if (this.props.switch === true) {
      return (
        <MDCSwitchReact
          classNames={classes.join(" ")}
          disabled={this.context.state.sessionWorking}
          on={this.context.state.sessionRunning}
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
            this.context.dispatch({ type: "sessionToggle" });
          }}
          classNames={classes.join(" ")}
          label={label}
          disabled={this.context.state.sessionWorking}
          icon={this.context.state.sessionRunning ? "stop" : "play_arrow"}
        />
      );
    }
  }
}

SessionToggleButton.defaultProps = {
  onSessionStateChange: () => {},
  onSessionFetch: () => {},
  onSessionShutdown: () => {},
};

export default SessionToggleButton;
