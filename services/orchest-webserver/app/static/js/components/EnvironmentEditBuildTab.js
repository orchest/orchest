import React, { Fragment } from "react";
import io from "socket.io-client";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";

class EnvironmentEditBuildTab extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      building: false,
      ignoreIncomingLogs: false,
      environmentBuild: undefined,
    };

    this.BUILD_POLL_FREQUENCY = 3000;
    this.END_STATUSES = ["SUCCESS", "FAILURE", "ABORTED"];
    this.CANCELABLE_STATUSES = ["PENDING", "STARTED"];

    this.SOCKETIO_NAMESPACE_ENV_BUILDS =
      orchest.config["ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE"];

    // initialize Xterm addons
    this.fitAddon = new FitAddon();

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
      console.log(
        `SocketIO with namespace ${this.SOCKETIO_NAMESPACE_ENV_BUILDS} disconnected.`
      );
    }
    this.promiseManager.cancelCancelablePromises();
    clearInterval(this.environmentBuildInterval);
  }

  componentDidMount() {
    this.connectSocketIO();
    this.fitTerminal();
    this.environmentBuildPolling();
  }

  updateBuildStatus(environmentBuild) {
    if (this.CANCELABLE_STATUSES.indexOf(environmentBuild.status) !== -1) {
      this.setState({
        building: true,
      });
    } else {
      this.setState({
        building: false,
      });
    }
  }

  cancelBuild() {
    // send DELETE to cancel ongoing build
    if (
      this.state.environmentBuild &&
      this.CANCELABLE_STATUSES.indexOf(this.state.environmentBuild.status) !==
        -1
    ) {
      makeRequest(
        "DELETE",
        `/catch/api-proxy/api/environment-builds/${this.state.environmentBuild.build_uuid}`
      )
        .then(() => {
          // immediately fetch latest status
          // NOTE: this DELETE call doesn't actually destroy the resource, that's
          // why we're querying it again.
          this.environmentBuildRequest();
        })
        .catch((error) => {
          console.error(error);
        });

      this.setState({
        building: false,
      });
    } else {
      orchest.alert(
        "Could not cancel build, please try again in a few seconds."
      );
    }
  }

  updateEnvironmentBuildState(environmentBuild) {
    this.updateBuildStatus(environmentBuild);
    this.setState({
      environmentBuild: environmentBuild,
    });
  }

  environmentBuildRequest() {
    let environmentBuildRequestPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/environment-builds/most-recent/${this.props.environment.project_uuid}/${this.props.environment.uuid}`
      ),
      this.promiseManager
    );

    environmentBuildRequestPromise.promise
      .then((response) => {
        let environmentBuild = JSON.parse(response);
        this.updateEnvironmentBuildState(environmentBuild);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  environmentBuildPolling() {
    this.environmentBuildRequest();
    clearInterval(this.environmentBuildInterval);
    this.environmentBuildInterval = setInterval(
      this.environmentBuildRequest.bind(this),
      this.BUILD_POLL_FREQUENCY
    );
  }

  connectSocketIO() {
    // disable polling
    this.socket = io.connect(this.SOCKETIO_NAMESPACE_ENV_BUILDS, {
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log(
        `SocketIO connected on ${this.SOCKETIO_NAMESPACE_ENV_BUILDS}`
      );
    });

    this.socket.on("sio_streamed_task_data", (data) => {
      // ignore terminal outputs from other environment_uuids
      if (
        data.identity ==
        this.props.environment.project_uuid + "-" + this.props.environment.uuid
      ) {
        if (
          data["action"] == "sio_streamed_task_output" &&
          !this.state.ignoreIncomingLogs
        ) {
          let lines = data.output.split("\n");
          for (let x = 0; x < lines.length; x++) {
            if (x == lines.length - 1) {
              this.refManager.refs.term.terminal.write(lines[x]);
            } else {
              this.refManager.refs.term.terminal.write(lines[x] + "\n\r");
            }
          }
        } else if (data["action"] == "sio_streamed_task_started") {
          // This blocking mechanism makes sure old build logs are
          // not displayed after the user has started a build
          // during an ongoing build.
          this.refManager.refs.term.terminal.reset();
          this.setState({
            ignoreIncomingLogs: false,
          });
        }
      }
    });
  }

  build(e) {
    e.nativeEvent.preventDefault();

    this.setState({
      building: true,
    });

    if (this.refManager.refs.term) {
      this.refManager.refs.term.terminal.reset();

      this.setState({
        ignoreIncomingLogs: true,
      });
    }

    this.props.saveEnvironment().then(() => {
      makeRequest("POST", "/catch/api-proxy/api/environment-builds", {
        type: "json",
        content: {
          environment_build_requests: [
            {
              environment_uuid: this.props.environment.uuid,
              project_uuid: this.props.environment.project_uuid,
            },
          ],
        },
      })
        .then((response) => {
          try {
            let environmentBuild = JSON.parse(response)[
              "environment_builds"
            ][0];
            this.updateEnvironmentBuildState(environmentBuild);
          } catch (error) {
            console.error(error);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    });
  }

  fitTerminal() {
    if (
      this.refManager.refs.term &&
      this.refManager.refs.term.terminal.element.offsetParent
    ) {
      setTimeout(() => {
        try {
          this.fitAddon.fit();
        } catch {
          console.warn(
            "fitAddon.fit() failed - Xterm only allows fit when element is visible."
          );
        }
      });
    }
  }

  componentDidUpdate() {
    this.fitTerminal();
  }

  render() {
    return (
      <Fragment>
        {(() => {
          if (this.state.environmentBuild) {
            return (
              <div className="build-status">
                <div>Build status: {this.state.environmentBuild.status}</div>
                <div>
                  Build started:{" "}
                  {this.state.environmentBuild.started_time ? (
                    new Date(
                      this.state.environmentBuild.started_time + " GMT"
                    ).toLocaleString()
                  ) : (
                    <i>not yet started</i>
                  )}
                </div>
                <div>
                  Build finished:{" "}
                  {this.state.environmentBuild.finished_time ? (
                    new Date(
                      this.state.environmentBuild.finished_time + " GMT"
                    ).toLocaleString()
                  ) : (
                    <i>not yet finished</i>
                  )}
                </div>
              </div>
            );
          }
        })()}

        <div>
          <div className={"xterm-holder push-up "}>
            <XTerm addons={[this.fitAddon]} ref={this.refManager.nrefs.term} />
          </div>
        </div>

        <div className="multi-button push-up push-down">
          {(() => {
            if (!this.state.building) {
              return (
                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  onClick={this.build.bind(this)}
                  label="Build"
                  icon="memory"
                />
              );
            } else {
              return (
                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  onClick={this.cancelBuild.bind(this)}
                  label="Cancel build"
                  icon="memory"
                />
              );
            }
          })()}
        </div>
      </Fragment>
    );
  }
}

export default EnvironmentEditBuildTab;
