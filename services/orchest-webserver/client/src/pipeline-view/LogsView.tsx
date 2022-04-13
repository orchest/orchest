import { IconButton } from "@/components/common/IconButton";
import { Layout } from "@/components/Layout";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import LogViewer from "@/pipeline-view/LogViewer";
import { siteMap } from "@/Routes";
import type {
  Job,
  LogType,
  PipelineJson,
  PipelineStepState,
  Step,
  StepsDict,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import {
  addOutgoingConnections,
  filterServices,
  getPipelineJSONEndpoint,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  hasValue,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import React from "react";
import io from "socket.io-client";
import { SocketIO } from "./hooks/useSocketIO";

export type ILogsViewProps = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const LogViewerPlaceHolder = () => (
  <Stack
    alignItems="center"
    justifyContent="center"
    sx={{
      backgroundColor: (theme) => theme.palette.common.black,
      width: "100%",
      height: "100%",
      color: (theme) => theme.palette.grey[800],
    }}
  >
    <Typography variant="h3" component="span">
      No logs available
    </Typography>
  </Stack>
);

const LogsView: React.FC = () => {
  // global states

  useSendAnalyticEvent("view load", { name: siteMap.logs.path });

  // data from route
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    navigateTo,
  } = useCustomRoute();

  const isQueryArgsComplete = hasValue(pipelineUuid) && hasValue(projectUuid);

  const { getSession } = useSessionsContext();

  const isJobRun = hasValue(jobUuid && runUuid);

  const promiseManager = React.useMemo(() => new PromiseManager(), []);

  const [selectedLog, setSelectedLog] = React.useState<{
    type: LogType;
    logId: string;
  } | null>(null);
  const [sortedSteps, setSortedSteps] = React.useState<
    PipelineStepState[] | undefined
  >(undefined);
  const [sio, setSio] = React.useState<SocketIO | undefined>(undefined);
  const [job, setJob] = React.useState<Job | undefined>(undefined);

  // Conditional fetch session
  let session =
    !jobUuid && hasValue(projectUuid) && hasValue(pipelineUuid)
      ? getSession({ projectUuid, pipelineUuid })
      : undefined;

  React.useEffect(() => {
    connectSocketIO();
    fetchPipelineJson();

    if (jobUuid) {
      fetchJob();
    }

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

  const topologicalSort = (pipelineSteps: Record<string, Step>) => {
    let sortedStepKeys: string[] = [];

    const mutatedPipelineSteps = addOutgoingConnections(
      pipelineSteps as StepsDict
    );

    let conditionalAdd = (step: PipelineStepState) => {
      // add if all parents are already in the sortedStepKeys
      let parentsAdded = true;
      for (let connection of step.incoming_connections) {
        if (!sortedStepKeys.includes(connection)) {
          parentsAdded = false;
          break;
        }
      }

      if (!sortedStepKeys.includes(step.uuid) && parentsAdded) {
        sortedStepKeys.push(step.uuid);
      }
    };

    // Add self and children (breadth first)
    let addSelfAndChildren = (step: PipelineStepState) => {
      conditionalAdd(step);

      step.outgoing_connections = step.outgoing_connections || ([] as string[]);

      for (let childStepUUID of step.outgoing_connections) {
        let childStep = mutatedPipelineSteps[childStepUUID];

        conditionalAdd(childStep);
      }

      // Recurse down
      for (let childStepUUID of step.outgoing_connections) {
        addSelfAndChildren(mutatedPipelineSteps[childStepUUID]);
      }
    };

    // Find roots
    for (let stepUUID in mutatedPipelineSteps) {
      let step = mutatedPipelineSteps[stepUUID];
      if (step.incoming_connections.length == 0) {
        addSelfAndChildren(step);
      }
    }

    return sortedStepKeys.map((stepUUID) => mutatedPipelineSteps[stepUUID]);
  };

  const fetchPipelineJson = () => {
    if (!isQueryArgsComplete)
      return Promise.reject("projectUUid or pipelineUuid is missing");

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

        let sortedSteps = topologicalSort(fetchedPipeline.steps);
        setSortedSteps(sortedSteps);
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
    if (isQueryArgsComplete)
      navigateTo(isJobRun ? siteMap.jobRun.path : siteMap.pipeline.path, {
        query: {
          projectUuid,
          pipelineUuid,
          jobUuid,
          runUuid,
        },
      });
  };

  const onClickLog = (uuid: string, type: LogType) => {
    setSelectedLog({ type, logId: uuid });
  };

  const hasLoaded = sortedSteps !== undefined && sio && (!jobUuid || job);

  const services = React.useMemo(() => {
    if (!hasLoaded) return {};
    let services = {};

    // If there is no job_uuid use the session for
    // fetch the services
    if (jobUuid == undefined && session && session.user_services) {
      services = session.user_services;
    }
    // if there is a job_uuid use the job pipeline to
    // fetch the services.
    else if (job?.pipeline_definition?.services !== undefined) {
      services = job.pipeline_definition.services;
    }

    return filterServices(services, jobUuid ? "noninteractive" : "interactive");
  }, [hasLoaded, job?.pipeline_definition?.services, jobUuid, session]);

  React.useEffect(() => {
    // Preselect first step, or service (if no step exists)
    if (sortedSteps !== undefined && !selectedLog) {
      if (sortedSteps.length > 0) {
        setSelectedLog({
          type: "step",
          logId: sortedSteps[0].uuid,
        });
      } else {
        if (Object.keys(services).length > 0) {
          setSelectedLog({
            type: "service",
            logId: services[Object.keys(services)[0]].name || "",
          });
        }
      }
    }
  }, [sortedSteps, selectedLog, session, services]);

  return (
    <Layout disablePadding>
      {!hasLoaded ? (
        <LinearProgress />
      ) : (
        <Stack direction="row" sx={{ position: "relative", height: "100%" }}>
          <Box
            sx={{
              width: "20%",
              minWidth: "250px",
            }}
          >
            <List
              dense
              sx={{ width: "100%", maxWidth: 360, bgcolor: "background.paper" }}
              subheader={
                <ListSubheader component="div">Step logs</ListSubheader>
              }
            >
              {sortedSteps.length == 0 && (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography component="i">
                        There are no steps defined.
                      </Typography>
                    }
                  />
                </ListItem>
              )}
              {sortedSteps.map((sortedStep) => {
                return (
                  <ListItemButton
                    key={sortedStep.uuid}
                    selected={
                      hasValue(selectedLog) &&
                      selectedLog.type === "step" &&
                      selectedLog.logId === sortedStep.uuid
                    }
                    onClick={() => onClickLog(sortedStep.uuid, "step")}
                  >
                    <ListItemText
                      primary={sortedStep.title}
                      secondary={sortedStep.file_path}
                    />
                  </ListItemButton>
                );
              })}
              <Divider />
            </List>
            <List
              dense
              sx={{ width: "100%", maxWidth: 360, bgcolor: "background.paper" }}
              subheader={
                <ListSubheader component="div">Service logs</ListSubheader>
              }
            >
              {!session && !job && (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography component="i">
                        There is no active session.
                      </Typography>
                    }
                  />
                </ListItem>
              )}
              {(session || job) && Object.keys(services).length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography component="i" variant="subtitle2">
                        There are no services defined.
                      </Typography>
                    }
                  />
                </ListItem>
              )}
              {Object.entries(services).map(([, service]) => {
                return (
                  <ListItemButton
                    key={service.name}
                    selected={
                      hasValue(selectedLog) &&
                      selectedLog.type === "service" &&
                      selectedLog.logId === service.name
                    }
                    onClick={() => onClickLog(service.name || "", "service")}
                  >
                    <ListItemText
                      primary={service.name}
                      secondary={service.image}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
          <Box sx={{ flex: 1 }}>
            {isQueryArgsComplete && sio && selectedLog ? (
              <LogViewer
                key={selectedLog.logId}
                sio={sio}
                pipelineUuid={pipelineUuid}
                projectUuid={projectUuid}
                jobUuid={jobUuid}
                runUuid={runUuid}
                {...selectedLog}
              />
            ) : (
              <LogViewerPlaceHolder />
            )}
          </Box>
          <Box
            sx={{
              position: "absolute",
              top: (theme) => theme.spacing(2),
              right: (theme) => theme.spacing(2),
              zIndex: 20,
            }}
          >
            <IconButton
              size="large"
              sx={{
                color: (theme) => theme.palette.common.white,
                backgroundColor: (theme) => theme.palette.grey[900],
                "&:hover": {
                  backgroundColor: (theme) => theme.palette.grey[800],
                },
              }}
              title="Close"
              onClick={close}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Stack>
      )}
    </Layout>
  );
};

export default LogsView;
