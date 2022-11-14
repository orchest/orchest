import { useInterval } from "@/hooks/useInterval";
import { LogType } from "@/types";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { FitAddon } from "xterm-addon-fit";
import { XTerm } from "xterm-for-react";
import { useSocketIO } from "./hooks/useSocketIO";

const HEARTBEAT_INTERVAL = 60 * 1000; // send heartbeat every minute

export interface LogViewerProps {
  pipelineUuid: string | undefined;
  projectUuid: string | undefined;
  jobUuid: string | undefined | null;
  runUuid: string | undefined | null;
  type: LogType;
  logId: string;
  terminalSx?: SxProps<Theme>;
}

export const LogViewer = ({
  jobUuid,
  logId,
  pipelineUuid,
  projectUuid,
  runUuid,
  type,
  terminalSx,
}: LogViewerProps) => {
  const sessionUuid = React.useMemo<string>(() => uuidv4(), []);
  const [heartbeatInterval, setHeartbeatInterval] = React.useState<
    number | null
  >(null);

  const socket = useSocketIO("/pty");
  const [xterm, setXterm] = React.useState<XTerm | null>(null);
  const fitAddon = React.useMemo(() => new FitAddon(), []);

  const onPtyOutputHandler = React.useCallback(
    (data) => {
      if (data.session_uuid === sessionUuid && xterm) {
        let lines = data.output.split("\n");
        for (let x = 0; x < lines.length; x++) {
          if (x === lines.length - 1) {
            xterm.terminal.write(lines[x]);
          } else {
            xterm.terminal.write(lines[x] + "\n\r");
          }
        }
      }
    },
    [sessionUuid, xterm]
  );

  const onPtyReset = React.useCallback(
    (data: { session_uuid: string }) => {
      if (data.session_uuid === sessionUuid) {
        xterm?.terminal.reset();
      }
    },
    [sessionUuid, xterm]
  );

  const initializeSocketIOListener = React.useCallback(() => {
    socket?.on("pty-output", onPtyOutputHandler);
    socket?.on("pty-reset", onPtyReset);

    setHeartbeatInterval(HEARTBEAT_INTERVAL);
  }, [onPtyOutputHandler, onPtyReset, socket]);

  const fitTerminal = React.useCallback(() => {
    if (!xterm?.terminal.element?.offsetParent) return;

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        console.warn(
          "fitAddon.fit() failed - Xterm only allows fit when element is visible."
        );
      }
    });
  }, [fitAddon, xterm]);

  const resizeObserver = React.useMemo(() => {
    return new ResizeObserver(fitTerminal);
  }, [fitTerminal]);

  React.useEffect(() => {
    if (!xterm?.terminalRef.current) return;

    resizeObserver.observe(xterm.terminalRef.current);

    return () => resizeObserver.disconnect();
  }, [xterm, resizeObserver]);

  const startLogSession = React.useCallback(() => {
    if (!projectUuid || !pipelineUuid) return;
    const data = {
      action: "fetch-logs",
      session_uuid: sessionUuid,
      pipeline_uuid: pipelineUuid,
      project_uuid: projectUuid,
    };

    // LogViewer supports either a step_uuid or a service_name, never both.
    if (type === "step") {
      data["step_uuid"] = logId;
    } else if (type === "service") {
      data["service_name"] = logId;
    }

    if (runUuid && jobUuid) {
      data["pipeline_run_uuid"] = runUuid;
      data["job_uuid"] = jobUuid;
    }

    socket?.emit("pty-log-manager", data);
  }, [
    jobUuid,
    logId,
    pipelineUuid,
    projectUuid,
    runUuid,
    sessionUuid,
    socket,
    type,
  ]);

  useInterval(() => {
    if (sessionUuid) {
      socket?.emit("pty-log-manager", {
        action: "heartbeat",
        session_uuid: sessionUuid,
      });
    } else {
      console.warn("heartbeat can only be sent when session_uuid is set");
    }
  }, heartbeatInterval);

  React.useEffect(() => {
    // initialize socket.io listener
    initializeSocketIOListener();
    startLogSession();

    fitTerminal();

    return () => {
      // stop logging
      socket?.emit("pty-log-manager", {
        action: "stop-logs",
        session_uuid: sessionUuid,
      });

      socket?.off("pty-output", onPtyOutputHandler);
      socket?.off("pty-reset", onPtyReset);
    };
  }, [
    fitTerminal,
    initializeSocketIOListener,
    onPtyOutputHandler,
    onPtyReset,
    sessionUuid,
    socket,
    startLogSession,
  ]);

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
        ...terminalSx,
      }}
    >
      <XTerm addons={[fitAddon]} ref={setXterm} />
    </Box>
  );
};
