import { useSessionsContext } from "@/contexts/SessionsContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { LogViewer } from "@/pipeline-view/LogViewer";
import type { LogType } from "@/types";
import { filterServices } from "@/utils/webserver-utils";
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
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { topologicalSort } from "./common";
import { LogViewerPlaceHolder } from "./LogViewerPlaceHolder";

export const PipelineLogs = () => {
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    pipelineJson,
    isJobRun,
  } = usePipelineDataContext();

  useSendAnalyticEvent("view:loaded", {
    name: isJobRun ? "/job-run/logs" : "/logs",
  });

  const { job } = useFetchJob({ jobUuid });
  const isQueryArgsComplete = hasValue(pipelineUuid) && hasValue(projectUuid);

  const sortedSteps = React.useMemo(() => {
    if (!pipelineJson) return undefined;
    return topologicalSort(cloneDeep(pipelineJson.steps));
  }, [pipelineJson]);

  const { getSession } = useSessionsContext();

  const [selectedLog, setSelectedLog] = React.useState<{
    type: LogType;
    logId: string;
  } | null>(null);

  const session = getSession(pipelineUuid);

  const onClickLog = (uuid: string, type: LogType) => {
    setSelectedLog({ type, logId: uuid });
  };

  const hasLoaded = sortedSteps !== undefined && (!jobUuid || job);

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
    <>
      {!hasLoaded ? (
        <LinearProgress />
      ) : (
        <Stack
          direction="row"
          sx={{
            position: "relative",
            height: (theme) => `calc(100vh - ${theme.spacing(21)})`,
          }}
        >
          <Box
            sx={{
              width: "20%",
              minWidth: "250px",
            }}
          >
            <List
              dense
              sx={{
                width: "100%",
                maxWidth: 360,
              }}
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
              sx={{
                width: "100%",
                maxWidth: 360,
                bgcolor: "background.paper",
              }}
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
          <Box
            sx={{
              flex: 1,
              backgroundColor: (theme) => theme.palette.common.black,
              borderBottomRightRadius: (theme) => theme.spacing(1),
            }}
          >
            {isQueryArgsComplete && selectedLog ? (
              <LogViewer
                key={selectedLog.logId}
                pipelineUuid={pipelineUuid}
                projectUuid={projectUuid}
                jobUuid={jobUuid}
                runUuid={runUuid}
                {...selectedLog}
                terminalSx={{
                  height: (theme) => `calc(100vh - ${theme.spacing(22)})`,
                }}
              />
            ) : (
              <LogViewerPlaceHolder />
            )}
          </Box>
        </Stack>
      )}
    </>
  );
};
