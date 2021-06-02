import React from "react";
import PipelineView from "./PipelineView";
import LogViewer from "../components/LogViewer";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
} from "@orchest/lib-utils";

import io from "socket.io-client";
import {
  MDCButtonReact,
  MDCLinearProgressReact,
  MDCDrawerReact,
} from "@orchest/lib-mdc";
import { useOrchest, OrchestSessionsConsumer } from "@/hooks/orchest";
import {
  getPipelineJSONEndpoint,
  createOutgoingConnections,
} from "../utils/webserver-utils";

const LogsView = (props) => {
  const { state, dispatch, get } = useOrchest();
  const session = get.session(props.queryArgs);
  const promiseManager = new PromiseManager();

  const [selectedLog, setSelectedLog] = React.useState(undefined);
  const [logType, setLogType] = React.useState(undefined);
  const [sortedSteps, setSortedSteps] = React.useState(undefined);
  const [pipelineJson, setPipelineJson] = React.useState(undefined);
  const [sio, setSio] = React.useState(undefined);

  React.useEffect(() => {
    connectSocketIO();
    fetchPipeline();

    return () => {
      promiseManager.cancelCancelablePromises();
      disconnectSocketIO();
    };
  }, []);

  const connectSocketIO = () => {
    // disable polling
    let socket = io.connect("/pty", { transports: ["websocket"] });

    socket.on("connect", () => {
      setSio(socket);
    });
  };

  const disconnectSocketIO = () => {
    if (sio) {
      sio.disconnect();
    }
  };

  const topologicalSort = (pipelineSteps) => {
    let sortedStepKeys = [];

    pipelineSteps = createOutgoingConnections(pipelineSteps);

    // Add self and children (breadth first)
    let addSelfAndChildren = (step) => {
      if (sortedStepKeys.indexOf(step.uuid) == -1) {
        sortedStepKeys.push(step.uuid);
      }

      for (let x = 0; x < step.outgoing_connections.length; x++) {
        let childStepUUID = step.outgoing_connections[x];
        if (sortedStepKeys.indexOf(childStepUUID) == -1) {
          sortedStepKeys.push(childStepUUID);
        }
      }

      // Recurse down
      for (let x = 0; x < step.outgoing_connections.length; x++) {
        let childStepUUID = step.outgoing_connections[x];
        addSelfAndChildren(pipelineSteps[childStepUUID]);
      }
    };

    // Find roots
    for (let stepUUID in pipelineSteps) {
      let step = pipelineSteps[stepUUID];
      if (step.incoming_connections.length == 0) {
        addSelfAndChildren(step);
      }
    }

    return sortedStepKeys.map((stepUUID) => pipelineSteps[stepUUID]);
  };

  const setHeaderComponent = (pipelineName) => {
    dispatch({
      type: "pipelineSet",
      payload: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        pipelineName: pipelineName,
      },
    });
  };

  const fetchPipeline = () => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      props.queryArgs.pipeline_uuid,
      props.queryArgs.project_uuid,
      props.queryArgs.job_uuid,
      props.queryArgs.run_uuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManager
    );

    pipelinePromise.promise.then((response) => {
      let result = JSON.parse(response);

      if (result.success) {
        let pipelineJson = JSON.parse(result["pipeline_json"]);
        setPipelineJson(pipelineJson);

        let sortedSteps = topologicalSort(pipelineJson.steps);
        setSortedSteps(sortedSteps);
        setHeaderComponent(pipelineJson.name);

        // set first step as selectedLog
        if (sortedSteps.length > 0) {
          setSelectedLog(sortedSteps[0].uuid);
          setLogType("step");
        }
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  };

  const close = () => {
    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: props.queryArgs.pipeline_uuid,
        project_uuid: props.queryArgs.project_uuid,
        read_only: props.queryArgs.read_only,
        job_uuid: props.queryArgs.job_uuid,
        run_uuid: props.queryArgs.run_uuid,
      },
    });
  };

  const clickLog = (_, item) => {
    setSelectedLog(item.identifier);
    setLogType(item.type);
  };

  let rootView = undefined;

  if (pipelineJson && sortedSteps && sio && logType && selectedLog) {
    let steps = [];

    for (let step of sortedSteps) {
      steps.push({
        identifier: step.uuid,
        type: "step",
        label: (
          <>
            <span className="log-title">{step.title}</span>
            <br />
            <span>{step.file_path}</span>
          </>
        ),
      });
    }

    let services = [];

    if (session && session.user_services) {
      for (let key of Object.keys(session.user_services)) {
        let service = session.user_services[key];

        services.push({
          type: "service",
          identifier: service.name,
          label: (
            <>
              <span className="log-title">{service.name}</span>
              <br />
              <span>{service.image}</span>
            </>
          ),
        });
      }
    }

    let dynamicLogViewerProps = {};
    if (logType == "step") {
      dynamicLogViewerProps["step_uuid"] = selectedLog;
    } else if (logType == "service") {
      dynamicLogViewerProps["service_name"] = selectedLog;
    }

    rootView = (
      <div className="logs">
        <div className="log-selector">
          <div className="log-section">
            <i className="material-icons">device_hub</i>
            Step logs
          </div>
          <MDCDrawerReact
            items={steps}
            selectedIndex={logType == "step" ? undefined : -1}
            action={clickLog}
          />
          <div role="separator" className="mdc-list-divider" />
          <div className="log-section">
            <i className="material-icons">settings</i>
            Service logs
          </div>
          <MDCDrawerReact
            items={services}
            selectedIndex={logType == "service" ? undefined : -1}
            action={clickLog}
          />
        </div>
        <div className="logs-xterm-holder">
          {selectedLog && (
            <LogViewer
              key={selectedLog}
              sio={sio}
              pipeline_uuid={props.queryArgs.pipeline_uuid}
              project_uuid={props.queryArgs.project_uuid}
              job_uuid={props.queryArgs.job_uuid}
              run_uuid={props.queryArgs.run_uuid}
              {...dynamicLogViewerProps}
            />
          )}
        </div>

        <div className="top-buttons">
          <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={close}
          />
        </div>
      </div>
    );
  } else {
    rootView = <MDCLinearProgressReact />;
  }

  return (
    <OrchestSessionsConsumer>
      <div className="view-page no-padding logs-view">{rootView}</div>
    </OrchestSessionsConsumer>
  );
};

export default LogsView;
