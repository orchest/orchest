import { Layout } from "@/components/Layout";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useOrchest } from "@/hooks/orchest";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import LogViewer from "@/pipeline-view/LogViewer";
import { siteMap } from "@/Routes";
import type { PipelineJson, TViewPropsWithRequiredQueryArgs } from "@/types";
import {
  addOutgoingConnections,
  filterServices,
  getPipelineJSONEndpoint,
} from "@/utils/webserver-utils";
import LinearProgress from "@mui/material/LinearProgress";
import { MDCButtonReact, MDCDrawerReact } from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import io from "socket.io-client";

export type ILogsViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const LogsView: React.FC = () => {
  // global states
  const { dispatch } = useOrchest();
  const { getSession } = useSessionsContext();
  useSessionsPoller();

  // data from route
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    isReadOnly,
    navigateTo,
  } = useCustomRoute();

  const [promiseManager] = React.useState(new PromiseManager());

  const [selectedLog, setSelectedLog] = React.useState(undefined);
  const [logType, setLogType] = React.useState(undefined);
  const [sortedSteps, setSortedSteps] = React.useState(undefined);
  const [pipelineJson, setPipelineJson] = React.useState(undefined);
  const [sio, setSio] = React.useState(undefined);
  const [job, setJob] = React.useState(undefined);

  // Conditional fetch session
  let session = !jobUuid
    ? getSession({ pipelineUuid, projectUuid })
    : undefined;

  React.useEffect(() => {
    connectSocketIO();
    fetchPipeline();

    if (jobUuid) {
      fetchJob();
    }

    return () => {
      promiseManager.cancelCancelablePromises();
      disconnectSocketIO();
    };
  }, []);

  React.useEffect(() => {
    // Preselect first step, or service (if no step exists)
    if (
      pipelineJson !== undefined &&
      pipelineJson !== undefined &&
      !selectedLog
    ) {
      if (sortedSteps.length > 0) {
        setSelectedLog(sortedSteps[0].uuid);
        setLogType("step");
      } else {
        let services = getServices();
        if (Object.keys(services).length > 0) {
          setSelectedLog(services[Object.keys(services)[0]].name);
          setLogType("service");
        }
      }
    }
  }, [sortedSteps, session]);

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

    addOutgoingConnections(pipelineSteps);

    let conditionalAdd = (step) => {
      // add iff all parents are already in the sortedStepKeys
      let parentsAdded = true;
      for (let x = 0; x < step.incoming_connections.length; x++) {
        if (sortedStepKeys.indexOf(step.incoming_connections[x]) == -1) {
          parentsAdded = false;
          break;
        }
      }

      if (sortedStepKeys.indexOf(step.uuid) == -1 && parentsAdded) {
        sortedStepKeys.push(step.uuid);
      }
    };

    // Add self and children (breadth first)
    let addSelfAndChildren = (step) => {
      conditionalAdd(step);

      for (let x = 0; x < step.outgoing_connections.length; x++) {
        let childStepUUID = step.outgoing_connections[x];
        let childStep = pipelineSteps[childStepUUID];

        conditionalAdd(childStep);
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

  const setHeaderComponent = (pipelineName: string) => {
    dispatch({
      type: "pipelineSet",
      payload: {
        pipelineUuid,
        projectUuid,
        pipelineName,
      },
    });
  };

  const getServices = () => {
    let services = {};

    // If there is no job_uuid use the session for
    // fetch the services
    if (jobUuid == undefined && session && session.user_services) {
      services = session.user_services;
    }
    // if there is a job_uuid use the job pipeline to
    // fetch the services.
    else if (job?.pipeline_definition.services !== undefined) {
      services = job.pipeline_definition.services;
    }

    let scope = jobUuid ? "noninteractive" : "interactive";
    return filterServices(services, scope);
  };

  const generateServiceItems = () => {
    let serviceItems = [];
    let services = getServices();

    for (let key of Object.keys(services)) {
      let service = services[key];

      serviceItems.push({
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

    return serviceItems;
  };

  const fetchPipeline = () => {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      pipelineUuid,
      projectUuid,
      jobUuid,
      runUuid
    );

    let pipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      promiseManager
    );

    pipelinePromise.promise.then((response) => {
      let result: {
        pipeline_json: string;
        success: boolean;
      } = JSON.parse(response);

      if (result.success) {
        let fetchedPipeline: PipelineJson = JSON.parse(result.pipeline_json);
        setPipelineJson(fetchedPipeline);

        let sortedSteps = topologicalSort(fetchedPipeline.steps);
        setSortedSteps(sortedSteps);
        setHeaderComponent(fetchedPipeline.name);
      } else {
        console.warn("Could not load pipeline.json");
        console.log(result);
      }
    });
  };

  const fetchJob = () => {
    makeRequest("GET", `/catch/api-proxy/api/jobs/${jobUuid}`).then(
      (response: string) => {
        try {
          setJob(JSON.parse(response));
        } catch (error) {
          console.error("Failed to fetch job.", error);
        }
      }
    );
  };

  const close = () => {
    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
      },
      state: { isReadOnly },
    });
  };

  const clickLog = (_, item) => {
    setSelectedLog(item.identifier);
    setLogType(item.type);
  };

  const getItemIndex = (items, access, value) => {
    for (let x = 0; x < items.length; x++) {
      if (access(items[x]) == value) {
        return x;
      }
    }
    return -1;
  };

  let rootView = undefined;

  const hasLoaded =
    pipelineJson && sortedSteps !== undefined && sio && (!jobUuid || job);
  if (hasLoaded) {
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

    let dynamicLogViewerProps = {};
    if (logType == "step") {
      dynamicLogViewerProps["stepUuid"] = selectedLog;
    } else if (logType == "service") {
      dynamicLogViewerProps["serviceName"] = selectedLog;
    }

    let services = generateServiceItems();

    rootView = (
      <div className="logs">
        <div className="log-selector">
          <div className="log-section">
            <i className="material-icons">device_hub</i>
            Step logs
          </div>
          {sortedSteps.length == 0 && (
            <i className="note">There are no steps defined.</i>
          )}
          <MDCDrawerReact
            items={steps}
            selectedIndex={
              logType == "step"
                ? getItemIndex(steps, (step) => step.identifier, selectedLog)
                : -1
            }
            action={clickLog}
          />
          <div role="separator" className="mdc-deprecated-list-divider" />
          <div className="log-section">
            <i className="material-icons">settings</i>
            Service logs
          </div>
          {!session && !job && (
            <i className="note">There is no active session.</i>
          )}
          {(session || job) && services.length == 0 && (
            <i className="note">There are no services defined.</i>
          )}
          <MDCDrawerReact
            items={services}
            selectedIndex={
              logType == "service"
                ? getItemIndex(
                    services,
                    (service) => service.identifier,
                    selectedLog
                  )
                : -1
            }
            action={clickLog}
          />
        </div>
        <div className="logs-xterm-holder">
          {selectedLog && logType && (
            <LogViewer
              key={selectedLog}
              sio={sio}
              pipelineUuid={pipelineUuid}
              projectUuid={projectUuid}
              jobUuid={jobUuid}
              runUuid={runUuid}
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
    rootView = <LinearProgress />;
  }

  return (
    <Layout>
      <div className="view-page no-padding logs-view">{rootView}</div>
    </Layout>
  );
};

export default LogsView;
