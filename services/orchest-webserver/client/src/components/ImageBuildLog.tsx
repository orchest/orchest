import { EnvironmentBuild } from "@/types";
import { fetcher, PromiseManager, RefManager } from "@orchest/lib-utils";
import React from "react";
import io from "socket.io-client";
import useSWR from "swr";
import { FitAddon } from "xterm-addon-fit";
import { XTerm } from "xterm-for-react";
import { ImageBuildStatus } from "./ImageBuildStatus";

const BUILD_POLL_FREQUENCY = [5000, 1000]; // poll more frequently during build

let socket;

const ImageBuild = ({
  onUpdateBuild,
  buildRequestEndpoint,
  buildsKey,
  ignoreIncomingLogs,
  streamIdentity,
  socketIONamespace,
  build,
  buildFetchHash,
  hideDefaultStatus,
}: {
  build: EnvironmentBuild | undefined;
  ignoreIncomingLogs: boolean;
  buildRequestEndpoint: string;
  buildsKey: string;
  onUpdateBuild: (newBuild: EnvironmentBuild) => void;
  socketIONamespace: string;
  streamIdentity: string;
  buildFetchHash: string;
  hideDefaultStatus?: boolean;
}) => {
  const [fitAddon] = React.useState(new FitAddon());
  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const { data: builds, mutate } = useSWR<EnvironmentBuild[]>(
    buildRequestEndpoint,
    (url) => fetcher(url).then((response) => response[buildsKey]),
    {
      refreshInterval: BUILD_POLL_FREQUENCY[build ? 1 : 0],
    }
  );

  React.useEffect(() => {
    mutate();
  }, [buildFetchHash, mutate]);

  React.useEffect(() => {
    if (builds && builds.length > 0) {
      onUpdateBuild(builds[0]);
    }
  }, [builds, onUpdateBuild]);

  const connectSocketIO = () => {
    // disable polling
    socket = io.connect(socketIONamespace, {
      transports: ["websocket"],
    });

    socket.on(
      "sio_streamed_task_data",
      (data: { action: string; identity: string; output?: string }) => {
        // ignore terminal outputs from other builds

        if (data.identity == streamIdentity) {
          if (
            data["action"] == "sio_streamed_task_output" &&
            !ignoreIncomingLogs
          ) {
            let lines = data.output.split("\n");
            for (let x = 0; x < lines.length; x++) {
              if (x == lines.length - 1) {
                refManager.refs.term.terminal.write(lines[x]);
              } else {
                refManager.refs.term.terminal.write(lines[x] + "\n\r");
              }
            }
          } else if (data["action"] == "sio_streamed_task_started") {
            // This blocking mechanism makes sure old build logs are
            // not displayed after the user has started a build
            // during an ongoing build.
            refManager.refs.term.terminal.reset();
          }
        }
      }
    );
  };

  const fitTerminal = () => {
    if (
      refManager.refs.term &&
      refManager.refs.term.terminal.element.offsetParent
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

  React.useEffect(() => {
    connectSocketIO();
    fitTerminal();
    window.addEventListener("resize", fitTerminal);

    return () => {
      if (socket) socket.close();
      promiseManager.cancelCancelablePromises();
      window.removeEventListener("resize", fitTerminal);
    };
  }, []);

  React.useEffect(() => fitTerminal());

  React.useEffect(() => {
    if (refManager.refs.terminal && ignoreIncomingLogs) {
      refManager.refs.term.terminal.reset();
    }
  }, [ignoreIncomingLogs]);

  return (
    <>
      {!hideDefaultStatus && <ImageBuildStatus build={build} />}
      <div className={"xterm-holder push-down"}>
        <XTerm addons={[fitAddon]} ref={refManager.nrefs.term} />
      </div>
    </>
  );
};

export default ImageBuild;
