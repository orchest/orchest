import React, { Fragment } from "react";
import io from "socket.io-client";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";
import {
  RefManager,
} from "../lib/utils/all";

class EnvironmentEditBuildTab extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      building: false,
      ignoreIncomingLogs: this.props.ignoreIncomingLogs
    };

    this.SOCKETIO_NAMESPACE_ENV_BUILDS =
      orchest.config["ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE"];

    // initialize Xterm addons
    this.fitAddon = new FitAddon();

    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
      console.log(
        `SocketIO with namespace ${this.SOCKETIO_NAMESPACE_ENV_BUILDS} disconnected.`
      );
    }
  }

  componentDidMount() {
    this.connectSocketIO();
    this.fitTerminal();
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
          this.props.onBuildStarted();
        }
      }
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

  componentDidUpdate(prevProps, prevState, snapshot) {

    if(prevProps.ignoreIncomingLogs != this.props.ignoreIncomingLogs){
      this.setState({
        ignoreIncomingLogs: this.props.ignoreIncomingLogs
      });
      if(this.refManager.refs.terminal && this.props.ignoreIncomingLogs){
        this.refManager.refs.term.terminal.reset();
      }
    }

    this.fitTerminal();
  }

  render() {
    return (
      <Fragment>
        {(() => {
          if (this.props.environmentBuild) {
            return (
              <div className="environment-notice">
                <div><span className='build-label'>Build status:</span>
                  {this.props.environmentBuild.status}</div>
                <div>
                  <span className='build-label'>Build started:</span>
                  {this.props.environmentBuild.started_time ? (
                    new Date(
                      this.props.environmentBuild.started_time + " GMT"
                    ).toLocaleString()
                  ) : (
                    <i>not yet started</i>
                  )}
                </div>
                <div>
                  <span className='build-label'>Build finished:</span>
                  {this.props.environmentBuild.finished_time ? (
                    new Date(
                      this.props.environmentBuild.finished_time + " GMT"
                    ).toLocaleString()
                  ) : (
                    <i>not yet finished</i>
                  )}
                </div>
              </div>
            );
          }
        })()}

        <div className={"xterm-holder push-down"}>
          <XTerm addons={[this.fitAddon]} ref={this.refManager.nrefs.term} />
        </div>

      </Fragment>
    );
  }
}

export default EnvironmentEditBuildTab;
