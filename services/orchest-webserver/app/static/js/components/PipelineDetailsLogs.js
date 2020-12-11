import React from "react";
import { RefManager, uuidv4 } from "../lib/utils/all";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";

require("codemirror/mode/shell/shell");

class PipelineDetailsLogs extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      logs: "",
    };

    this.refManager = new RefManager();
    this.fitAddon = new FitAddon();

    this.HEARTBEAT_INTERVAL = 60 * 1000; // send heartbeat every minute
  }
  componentDidMount() {
    // intialize socket.io listener
    this.initializeSocketIOListener();
    this.startLogSession();
  }

  initializeSocketIOListener() {
    this.onPtyOutputHandler = (data) => {
      if (data.session_uuid == this.session_uuid) {
        let lines = data.output.split("\n");
        for (let x = 0; x < lines.length; x++) {
          if (x == lines.length - 1) {
            this.refManager.refs.term.terminal.write(lines[x]);
          } else {
            this.refManager.refs.term.terminal.write(lines[x] + "\n\r");
          }
        }
      }
    };

    this.onPtyReset = (data) => {
      if (data.session_uuid == this.session_uuid) {
        this.refManager.refs.term.terminal.reset();
      }
    };

    this.props.sio.on("pty-output", this.onPtyOutputHandler);
    this.props.sio.on("pty-reset", this.onPtyReset);

    // heartbeat message
    this.heartBeatInterval = setInterval(() => {
      if (this.session_uuid) {
        this.props.sio.emit("pty-log-manager", {
          action: "heartbeat",
          session_uuid: this.session_uuid,
        });
      } else {
        console.warn("heartbeat can only be sent when session_uuid is set");
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  componentWillUnmount() {
    this.stopLog();

    this.props.sio.off("pty-output", this.onPtyOutputHandler);
    this.props.sio.off("pty-reset", this.onPtyReset);

    clearInterval(this.heartBeatInterval);
  }

  componentDidUpdate() {
    if (
      this.refManager.refs.term &&
      this.refManager.refs.term.terminal.element.offsetParent != null
    ) {
      this.fitAddon.fit();
    }
  }

  stopLog() {
    this.props.sio.emit("pty-log-manager", {
      action: "stop-logs",
      session_uuid: this.session_uuid,
    });
  }

  startLogSession() {
    this.session_uuid = uuidv4();

    let data = {
      action: "fetch-logs",
      session_uuid: this.session_uuid,
      pipeline_uuid: this.props.pipeline.uuid,
      project_uuid: this.props.project_uuid,
      step_uuid: this.props.step.uuid,
    };

    if (this.props.pipelineRun) {
      data["pipeline_run_uuid"] = this.props.pipelineRun.run_uuid;
      data["experiment_uuid"] = this.props.pipelineRun.experiment_uuid;
    }

    this.props.sio.emit("pty-log-manager", data);
  }

  render() {
    return (
      <div className={"detail-subview"}>
        <div className="log-content">
          <XTerm addons={[this.fitAddon]} ref={this.refManager.nrefs.term} />
        </div>
      </div>
    );
  }
}

export default PipelineDetailsLogs;
