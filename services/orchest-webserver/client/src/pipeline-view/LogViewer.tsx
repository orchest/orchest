import { useInterval } from "@/hooks/use-interval";
import { LogType } from "@/types";
import Box from "@mui/material/Box";
import { RefManager, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { FitAddon } from "xterm-addon-fit";
import { XTerm } from "xterm-for-react";
import { SocketIO } from "./hooks/useSocketIO";

const HEARTBEAT_INTERVAL = 60 * 1000; // send heartbeat every minute

export interface ILogViewerProps {
  sio: SocketIO;
  pipelineUuid: string;
  projectUuid: string;
  jobUuid: string;
  runUuid: string;
  type: LogType;
  logId: string;
}

const LogViewer: React.FC<ILogViewerProps> = (props) => {
  const [sessionUuid, setSessionUuid] = React.useState(null);
  const [heartbeatInterval, setHeartbeatInterval] = React.useState(null);

  const [refManager] = React.useState(new RefManager());
  const [fitAddon] = React.useState(new FitAddon());

  const generateSessionUuid = () => setSessionUuid(uuidv4());

  const onPtyOutputHandler = (data) => {
    if (data.session_uuid == sessionUuid) {
      let lines = data.output.split("\n");
      for (let x = 0; x < lines.length; x++) {
        if (x == lines.length - 1) {
          refManager.refs.term.terminal.write(lines[x]);
        } else {
          refManager.refs.term.terminal.write(lines[x] + "\n\r");
        }
      }
    }
  };

  const onPtyReset = (data) => {
    if (data.session_uuid == sessionUuid) {
      refManager.refs.term.terminal.reset();
    }
  };

  const initializeSocketIOListener = () => {
    props.sio.on("pty-output", onPtyOutputHandler);
    props.sio.on("pty-reset", onPtyReset);

    setHeartbeatInterval(HEARTBEAT_INTERVAL);
  };

  const fitTerminal = () => {
    if (
      refManager.refs.term &&
      refManager.refs.term.terminal.element.offsetParent != null
    ) {
      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch {
          console.warn(
            "fitAddon.fit() failed - Xterm only allows fit when element is visible."
          );
        }
      });
    }
  };

  const stopLog = () => {
    props.sio.emit("pty-log-manager", {
      action: "stop-logs",
      session_uuid: sessionUuid,
    });
  };

  const startLogSession = () => {
    let data = {
      action: "fetch-logs",
      session_uuid: sessionUuid,
      pipeline_uuid: props.pipelineUuid,
      project_uuid: props.projectUuid,
    };

    // LogViewer supports either a step_uuid or a service_name, never both.
    if (props.type === "step") {
      data["step_uuid"] = props.logId;
    } else if (props.type === "service") {
      data["service_name"] = props.logId;
    }

    if (props.runUuid && props.jobUuid) {
      data["pipeline_run_uuid"] = props.runUuid;
      data["job_uuid"] = props.jobUuid;
    }

    props.sio.emit("pty-log-manager", data);
  };

  useInterval(() => {
    if (sessionUuid) {
      props.sio.emit("pty-log-manager", {
        action: "heartbeat",
        session_uuid: sessionUuid,
      });
    } else {
      console.warn("heartbeat can only be sent when session_uuid is set");
    }
  }, heartbeatInterval);

  React.useEffect(() => {
    generateSessionUuid();
    // initialize socket.io listener
    initializeSocketIOListener();
    startLogSession();

    window.addEventListener("resize", fitTerminal);
    fitTerminal();

    return () => {
      stopLog();

      props.sio.off("pty-output", onPtyOutputHandler);
      props.sio.off("pty-reset", onPtyReset);

      window.removeEventListener("resize", fitTerminal);
    };
  }, []);

  React.useEffect(() => fitTerminal());

  React.useEffect(() => {
    generateSessionUuid();
  }, [props]);

  return (
    <Box
      sx={{
        height: "100%",
        backgroundColor: (theme) => theme.palette.common.black,
        padding: (theme) => theme.spacing(1, 0, 1, 1),
        overflow: "hidden",
        // root of XTerm is a div without any class name
        "> div": {
          height: "100%",
        },
      }}
    >
      <XTerm addons={[fitAddon]} ref={refManager.nrefs.term} />
    </Box>
  );
};

export default LogViewer;
