import { useFetcher } from "@/hooks/useFetcher";
import { useInterval } from "@/hooks/useInterval";
import { useSocketIO } from "@/pipeline-view/hooks/useSocketIO";
import { EnvironmentImageBuild, JupyterImageBuild } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import { FitAddon } from "xterm-addon-fit";
import { XTerm } from "xterm-for-react";
import { ImageBuildStatus } from "../ImageBuildStatus";

type UseFetchEnvironmentBuildParams = {
  url: string;
  buildsKey: string;
  buildFetchHash: string;
  refreshInterval: number;
};

const useFetchEnvironmentBuild = ({
  url,
  buildsKey,
  buildFetchHash, // This allows external components to fire fetchData.
  refreshInterval,
}: UseFetchEnvironmentBuildParams): EnvironmentImageBuild | undefined => {
  const { data = [], fetchData, status } = useFetcher<
    Record<string, EnvironmentImageBuild[]>,
    EnvironmentImageBuild[]
  >(url, { transform: (data) => data[buildsKey] || Promise.reject() });

  const shouldReFetch = React.useRef(false);

  React.useEffect(() => {
    // Only re-fetch if a previous request has taken place.
    if (status === "REJECTED" || status === "RESOLVED")
      shouldReFetch.current = true;
  }, [status]);

  React.useEffect(() => {
    if (shouldReFetch.current) {
      shouldReFetch.current = false;
      fetchData();
    }
  }, [fetchData, buildFetchHash]);

  useInterval(fetchData, refreshInterval);

  return data[0]; // Return the latest build.
};

type ImageBuildLogProps = {
  build: EnvironmentImageBuild | JupyterImageBuild | undefined;
  ignoreIncomingLogs: boolean;
  buildRequestEndpoint: string;
  buildsKey: string;
  onUpdateBuild: (newBuild: EnvironmentImageBuild) => void;
  socketIONamespace: string | undefined;
  streamIdentity: string;
  buildFetchHash: string;
  hideDefaultStatus?: boolean;
};

export const LegacyImageBuildLog = ({
  onUpdateBuild,
  buildRequestEndpoint,
  buildsKey,
  ignoreIncomingLogs,
  streamIdentity,
  socketIONamespace = "",
  build,
  buildFetchHash,
  hideDefaultStatus,
}: ImageBuildLogProps) => {
  const fitAddon = React.useMemo(() => new FitAddon(), []);
  const xtermRef = React.useRef<XTerm | null>(null);

  const fetchedBuild = useFetchEnvironmentBuild({
    url: buildRequestEndpoint,
    buildsKey,
    buildFetchHash,
    refreshInterval:
      build && ["PENDING", "STARTED"].includes(build.status) ? 1000 : 5000, // poll more frequently during build
  });

  React.useEffect(() => {
    if (fetchedBuild) onUpdateBuild(fetchedBuild);
  }, [fetchedBuild, onUpdateBuild]);

  const fitTerminal = React.useCallback(() => {
    if (xtermRef.current?.terminal.element?.offsetParent !== null) {
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
  }, [fitAddon, xtermRef]);

  const socket = useSocketIO(socketIONamespace);
  const hasRegisteredSocketIO = React.useRef(false);

  React.useEffect(() => {
    hasRegisteredSocketIO.current = false;
  }, [socket]);

  React.useEffect(() => {
    if (!hasRegisteredSocketIO.current) {
      hasRegisteredSocketIO.current = true;
      socket?.on(
        "sio_streamed_task_data",
        (data: { action: string; identity: string; output?: string }) => {
          // ignore terminal outputs from other builds

          if (data.identity === streamIdentity) {
            if (
              data.action === "sio_streamed_task_output" &&
              !ignoreIncomingLogs
            ) {
              let lines = (data.output || "").split("\n");
              for (let x = 0; x < lines.length; x++) {
                if (x > 0) xtermRef.current?.terminal.write("\n\r");
                xtermRef.current?.terminal.write(lines[x]);
              }
            } else if (data["action"] == "sio_streamed_task_started") {
              // This blocking mechanism makes sure old build logs are
              // not displayed after the user has started a build
              // during an ongoing build.
              xtermRef.current?.terminal.reset();
            }
          }
        }
      );
    }
  }, [socket, xtermRef, ignoreIncomingLogs, streamIdentity]);

  React.useEffect(() => {
    fitTerminal();
    window.addEventListener("resize", fitTerminal);
    return () => {
      window.removeEventListener("resize", fitTerminal);
    };
  }, [fitTerminal]);

  React.useEffect(() => {
    if (ignoreIncomingLogs) {
      xtermRef.current?.terminal.reset();
    }
  }, [ignoreIncomingLogs, xtermRef]);

  return (
    <>
      {!hideDefaultStatus && (
        <ImageBuildStatus
          build={build}
          sx={{ margin: (theme) => theme.spacing(3, 0) }}
        />
      )}
      <Stack direction="column">
        <Typography
          variant="caption"
          sx={{
            backgroundColor: (theme) => theme.palette.grey[700],
            borderRadius: (theme) => theme.spacing(0.5, 0.5, 0, 0),
            color: (theme) => theme.palette.common.white,
            padding: (theme) => theme.spacing(0.5, 1.5),
          }}
        >
          Logs
        </Typography>
        <Box
          sx={{
            overflow: "hidden",
            padding: (theme) => theme.spacing(1, 0, 0, 1),
            borderRadius: (theme) => theme.spacing(0, 0, 0.5, 0.5),
            backgroundColor: (theme) => theme.palette.common.black,
          }}
        >
          <XTerm addons={[fitAddon]} ref={xtermRef} />
        </Box>
      </Stack>
    </>
  );
};
