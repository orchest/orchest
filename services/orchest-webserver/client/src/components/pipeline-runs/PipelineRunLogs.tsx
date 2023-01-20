import { useSessionsContext } from "@/contexts/SessionsContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { LogViewer } from "@/pipeline-view/LogViewer";
import { LogType } from "@/types";
import { sortPipelineSteps } from "@/utils/pipeline";
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
import React from "react";

export type PipelineRunLogsProps = {
  projectUuid?: string;
  pipelineUuid?: string;
  jobUuid?: string;
  runUuid?: string;
};

export const PipelineRunLogs = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
}: PipelineRunLogsProps) => {
  const isJobRun = Boolean(jobUuid);

  useSendAnalyticEvent("view:loaded", {
    name: isJobRun ? "/job-run/logs" : "/logs",
  });

  const { pipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  const sortedSteps = React.useMemo(() => {
    return sortPipelineSteps(pipelineJson?.steps ?? {});
  }, [pipelineJson?.steps]);

  const { getSession } = useSessionsContext();
  const { job } = useFetchJob(jobUuid);

  const [selectedLog, setSelectedLog] = React.useState<{
    type: LogType;
    logId: string;
  } | null>(null);

  const session = getSession(pipelineUuid);

  const onClickLog = (uuid: string, type: LogType) =>
    setSelectedLog({ type, logId: uuid });

  const hasLoaded = sortedSteps.length > 0;

  const services = React.useMemo(() => {
    if (!hasLoaded) return {};

    if (!isJobRun && session && session.user_services) {
      return filterServices(session.user_services, "interactive");
    } else if (job?.pipeline_definition?.services) {
      return filterServices(job.pipeline_definition.services, "noninteractive");
    } else {
      return {};
    }
  }, [hasLoaded, job, isJobRun, session]);

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
              height: "100%",
              overflow: "hidden auto",
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
              {sortedSteps.length === 0 && (
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
              {!session && !isJobRun && (
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
              {(session || isJobRun) && Object.keys(services).length === 0 && (
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
            {selectedLog ? (
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

export const LogViewerPlaceHolder = () => (
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
