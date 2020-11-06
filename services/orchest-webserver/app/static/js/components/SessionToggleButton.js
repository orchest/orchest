import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { makeCancelable, makeRequest, PromiseManager } from "../lib/utils/all";

class SessionToggleButton extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      working: false,
      running: false,
    };

    this.promiseManager = new PromiseManager();
    this.STATUS_POLL_FREQUENCY = 1000;
  }

  onClick(e) {
    e.stopPropagation();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    clearInterval(this.sessionPollingInterval);
  }

  componentDidMount() {
    this.fetchSessionStatus();
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
        `/api-proxy/api/sessions/?project_uuid=${this.props.project_uuid}&pipeline_uuid=${this.props.pipeline_uuid}`
      ),
      this.promiseManager
    );

    fetchSessionPromise.promise.then((response) => {
      let session_details;

      let result = JSON.parse(response);

      if (result.sessions.length > 0) {
        session_details = result.sessions[0];

        if (session_details.status == "RUNNING") {
          this.setState({
            working: false,
            running: true,
            session_details,
          });

          this.props.onSessionStateChange(
            this.state.working,
            this.state.running,
            session_details
          );

          clearInterval(this.sessionPollingInterval);
        } else if (session_details.status == "LAUNCHING") {
          this.setState({
            working: true,
            running: false,
          });
          this.props.onSessionStateChange(
            this.state.working,
            this.state.running
          );

          this.initializeFetchSessionPolling();
        } else if (session_details.status == "STOPPING") {
          this.setState({
            working: true,
            running: true,
            session_details,
          });

          this.initializeFetchSessionPolling();
        }
      } else {
        this.setState({
          working: false,
          running: false,
        });
        this.props.onSessionStateChange(this.state.working, this.state.running);

        clearInterval(this.sessionPollingInterval);
      }

      this.props.onSessionFetch(session_details);
    });
  }

  toggleSession() {
    if (this.state.working) {
      let statusText = "launching";
      if (this.state.running) {
        statusText = "shutting down";
      }
      orchest.alert(
        "Error",
        "Please wait, the pipeline session is still " + statusText + "."
      );
      return;
    }

    if (!this.state.running) {
      // send launch request to API
      let data = {
        pipeline_uuid: this.props.pipeline_uuid,
        project_uuid: this.props.project_uuid,
      };

      this.setState({
        working: true,
      });
      this.props.onSessionStateChange(this.state.working, this.state.running);

      let launchPromise = makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/sessions/", {
          type: "json",
          content: data,
        }),
        this.promiseManager
      );

      launchPromise.promise
        .then((response) => {
          let session_details = JSON.parse(response);

          this.setState({
            working: false,
            running: true,
            session_details,
          });
          this.props.onSessionStateChange(
            this.state.working,
            this.state.running,
            session_details
          );
        })
        .catch((e) => {
          if (!e.isCanceled) {
            console.log(e);

            this.setState({
              working: false,
              running: false,
            });
            this.props.onSessionStateChange(
              this.state.working,
              this.state.running
            );
          }
        });
    } else {
      this.setState({
        working: true,
      });
      this.props.onSessionStateChange(this.state.working, this.state.running);
      this.props.onSessionShutdown();

      let deletePromise = makeCancelable(
        makeRequest(
          "DELETE",
          `/api-proxy/api/sessions/${this.props.project_uuid}/${this.props.pipeline_uuid}`
        ),
        this.promiseManager
      );

      deletePromise.promise
        .then((response) => {
          let result = JSON.parse(response);
          console.log("API delete result");
          console.log(result);

          this.setState({
            working: false,
            running: false,
          });
          this.props.onSessionStateChange(
            this.state.working,
            this.state.running
          );
        })
        .catch((err) => {
          if (!err.isCanceled) {
            console.log(
              "Error during request DELETEing launch to orchest-api."
            );
            console.log(err);

            if (err === undefined || (err && err.isCanceled !== true)) {
              this.setState({
                running: true,
                working: false,
              });
              this.props.onSessionStateChange(
                this.state.working,
                this.state.running
              );
            }
          }
        });
    }
  }

  getPowerButtonClasses() {
    let classes = [
      "mdc-power-button",
      "mdc-button--raised",
      "session-state-button",
    ];

    if (this.props.classNames) {
      classes = classes.concat(this.props.classNames);
    }
    if (this.state.running) {
      classes.push("active");
    }
    if (this.state.working) {
      classes.push("working");
    }

    return classes;
  }

  render() {
    return (
      <MDCButtonReact
        onClick={this.toggleSession.bind(this)}
        classNames={this.getPowerButtonClasses()}
        label="Session"
        icon={this.state.working ? "hourglass_empty" : "power_settings_new"}
      />
    );
  }
}

SessionToggleButton.defaultProps = {
  onSessionStateChange: () => {},
  onSessionFetch: () => {},
  onSessionShutdown: () => {},
};

export default SessionToggleButton;
