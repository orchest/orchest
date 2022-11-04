import { useProjectsContext } from "@/contexts/ProjectsContext";
import {
  getSessionKey,
  SESSIONS_ENDPOINT,
  useSessionsContext,
} from "@/contexts/SessionsContext";
import { siteMap } from "@/routingConfig";
import { OrchestSession } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { matchPath } from "react-router-dom";
import { useCustomRoute } from "./useCustomRoute";
import { useFetcher } from "./useFetcher";
import { useInterval } from "./useInterval";

type TSessionStatus = OrchestSession["status"];

type FetchSessionResponse = {
  sessions: (OrchestSession & {
    project_uuid: string;
    pipeline_uuid: string;
  })[];
  status: TSessionStatus;
};

/** NOTE: useSessionsPoller should only be placed in SessionStatus in HeaderBar*/
export const useSessionsPoller = () => {
  const [failures, setFailures] = React.useState(0);
  const { location, pipelineUuid } = useCustomRoute();
  const { dispatch } = useSessionsContext();
  const {
    state: { pipeline, pipelineReadOnlyReason },
  } = useProjectsContext();

  // add the view paths that requires polling sessions
  const matchRooViews = matchPath(location.pathname, [
    siteMap.configureJupyterLab.path,
  ]);
  const matchPipelineViews = matchPath(location.pathname, [
    siteMap.pipeline.path,
    siteMap.jupyterLab.path,
  ]);

  // sessions are only needed when both conditions are met
  // 1. in the ConfigureJupyterLabView (they are root views without a pipeline_uuid)
  // 2. in the above views AND pipelineUuid is given AND is not read-only
  const shouldPoll =
    matchRooViews?.isExact ||
    (!pipelineReadOnlyReason &&
      hasValue(pipeline) &&
      pipeline.uuid === pipelineUuid &&
      matchPipelineViews?.isExact);

  const { error, fetchData: fetchSessions } = useFetcher<
    FetchSessionResponse,
    Record<string, OrchestSession>
  >(SESSIONS_ENDPOINT, {
    transform: (data) =>
      data.sessions.reduce((sessionsObj, session) => {
        const {
          project_uuid: projectUuid,
          pipeline_uuid: pipelineUuid,
          ...sessionData
        } = session;
        const sessionKey = getSessionKey({ projectUuid, pipelineUuid });
        return { ...sessionsObj, [sessionKey]: sessionData };
      }, {} as Record<string, OrchestSession>),
  });

  // We cannot poll conditionally, e.g. only poll if a session status is transitional, e.g. LAUNCHING, STOPPING
  // the reason is that Orchest session is not a user session, but a session of a pipeline.
  // and Orchest sessions are not bound to a single user, therefore
  // this session (i.e. pipeline session) is used by potentially multiple users
  // in order to facilitate multiple users working at the same time, FE needs to check pipeline sessions at all times
  useInterval(
    () =>
      fetchSessions().then((response) => {
        if (response) {
          setFailures(0);

          dispatch({
            type: "SET_SESSIONS",
            payload: response,
          });
        }
      }),
    shouldPoll ? 1000 : undefined
  );

  React.useEffect(() => {
    if (shouldPoll) fetchSessions();
  }, [shouldPoll, fetchSessions]);

  React.useEffect(() => {
    if (error) setFailures((current) => current + 1);
  }, [error]);

  return { failures, error };
};
