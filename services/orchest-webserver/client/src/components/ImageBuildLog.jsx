import React, { Fragment } from "react";
import io from "socket.io-client";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";
import {
  makeRequest,
  makeCancelable,
  RefManager,
  PromiseManager,
} from "@orchest/lib-utils";
import { formatServerDateTime } from "../utils/webserver-utils";

class ImageBuild extends React.Component {
  constructor(props) {
    super(props);

    this.BUILD_POLL_FREQUENCY = [5000, 1000]; // poll more frequently during build
    this.END_STATUSES = ["SUCCESS", "FAILURE", "ABORTED"];

    this.state = {
      building: false,
      ignoreIncomingLogs: this.props.ignoreIncomingLogs,
    };

    // initialize Xterm addons
    this.fitAddon = new FitAddon();
    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
    }
    clearTimeout(this.buildTimeout);
    this.promiseManager.cancelCancelablePromises();

    window.removeEventListener("resize", this.fitTerminal.bind(this));
  }

  componentDidMount() {
    this.connectSocketIO();
    this.fitTerminal();
    this.buildPolling(true);

    window.addEventListener("resize", this.fitTerminal.bind(this));
  }

  buildPolling(triggerDirectly) {
    if (triggerDirectly) {
      this.buildRequest();
    }

    clearTimeout(this.buildTimeout);
    this.buildTimeout = setTimeout(
      () => {
        this.buildRequest();
        this.buildPolling(false);
      },
      this.props.building
        ? this.BUILD_POLL_FREQUENCY[1]
        : this.BUILD_POLL_FREQUENCY[0]
    );
  }

  buildRequest() {
    let buildRequestPromise = makeCancelable(
      makeRequest("GET", this.props.buildRequestEndpoint),
      this.promiseManager
    );

    buildRequestPromise.promise
      .then((response) => {
        let builds = JSON.parse(response)[this.props.buildsKey];
        if (builds.length > 0) {
          this.props.onUpdateBuild(builds[0]);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  connectSocketIO() {
    // disable polling
    this.socket = io.connect(this.props.socketIONamespace, {
      transports: ["websocket"],
    });

    this.socket.on("sio_streamed_task_data", (data) => {
      // ignore terminal outputs from other builds
      if (data.identity == this.props.streamIdentity) {
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
          this.props.onBuildStart();
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

  componentDidUpdate(prevProps) {
    if (prevProps.ignoreIncomingLogs != this.props.ignoreIncomingLogs) {
      this.setState({
        ignoreIncomingLogs: this.props.ignoreIncomingLogs,
      });
      if (this.refManager.refs.terminal && this.props.ignoreIncomingLogs) {
        this.refManager.refs.term.terminal.reset();
      }
    }

    if (prevProps.buildFetchHash != this.props.buildFetchHash) {
      this.buildPolling(true);
    }

    this.fitTerminal();
  }

  render() {
    return (
      <Fragment>
        {(() => {
          if (this.props.build) {
            return (
              <div className="build-notice push-down">
                <div>
                  <span className="build-label">Build status:</span>
                  {this.props.build.status}
                </div>
                <div>
                  <span className="build-label">Build requested:</span>
                  {this.props.build.requested_time ? (
                    formatServerDateTime(this.props.build.requested_time)
                  ) : (
                    <i>not yet requested</i>
                  )}
                </div>
                <div>
                  <span className="build-label">Build finished:</span>
                  {this.props.build.finished_time ? (
                    formatServerDateTime(this.props.build.finished_time)
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

export default ImageBuild;
