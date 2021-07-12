import * as React from "react";
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
import { useInterval } from "@/hooks/use-interval";

const BUILD_POLL_FREQUENCY = [5000, 1000]; // poll more frequently during build

let socket;

const ImageBuild: React.FC<any> = (props) => {
  const [state, setState] = React.useState({
    building: false,
    ignoreIncomingLogs: props.ignoreIncomingLogs,
  });

  const [isPolling, setIsPolling] = React.useState(null);

  const [fitAddon] = React.useState(new FitAddon());
  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const buildRequest = () => {
    let buildRequestPromise = makeCancelable(
      makeRequest("GET", props.buildRequestEndpoint),
      promiseManager
    );

    buildRequestPromise.promise
      .then((response) => {
        let builds = JSON.parse(response)[props.buildsKey];
        if (builds.length > 0) {
          props.onUpdateBuild(builds[0]);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const connectSocketIO = () => {
    // disable polling
    socket = io.connect(props.socketIONamespace, {
      transports: ["websocket"],
    });

    socket.on("sio_streamed_task_data", (data) => {
      // ignore terminal outputs from other builds
      if (data.identity == props.streamIdentity) {
        if (
          data["action"] == "sio_streamed_task_output" &&
          !state.ignoreIncomingLogs
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
          setState((prevState) => ({
            ...prevState,
            ignoreIncomingLogs: false,
          }));
          props.onBuildStart();
        }
      }
    });
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

  useInterval(
    () => buildRequest(),
    isPolling &&
      (props.build ? BUILD_POLL_FREQUENCY[1] : BUILD_POLL_FREQUENCY[0])
  );

  React.useEffect(() => {
    connectSocketIO();
    fitTerminal();
    setIsPolling(true);
    window.addEventListener("resize", fitTerminal.bind(this));

    return () => {
      if (socket) socket.close();
      promiseManager.cancelCancelablePromises();
      window.removeEventListener("resize", fitTerminal.bind(this));
    };
  }, []);

  React.useEffect(() => fitTerminal());

  React.useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      ignoreIncomingLogs: props.ignoreIncomingLogs,
    }));
    if (refManager.refs.terminal && props.ignoreIncomingLogs) {
      refManager.refs.term.terminal.reset();
    }
  }, [props.ignoreIncomingLogs]);

  React.useEffect(() => {
    setIsPolling(true);
  }, [props.buildFetchHash]);

  return (
    <React.Fragment>
      {props.build && (
        <div className="build-notice push-down">
          <div>
            <span className="build-label">Build status:</span>
            {props.build.status}
          </div>
          <div>
            <span className="build-label">Build requested:</span>
            {props.build.requested_time ? (
              formatServerDateTime(props.build.requested_time)
            ) : (
              <i>not yet requested</i>
            )}
          </div>
          <div>
            <span className="build-label">Build finished:</span>
            {props.build.finished_time ? (
              formatServerDateTime(props.build.finished_time)
            ) : (
              <i>not yet finished</i>
            )}
          </div>
        </div>
      )}

      <div className={"xterm-holder push-down"}>
        <XTerm addons={[fitAddon]} ref={refManager.nrefs.term} />
      </div>
    </React.Fragment>
  );
};

export default ImageBuild;
