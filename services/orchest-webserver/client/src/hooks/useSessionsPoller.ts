import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { siteMap } from "@/routingConfig";
import { IOrchestSession } from "@/types";
import { fetcher, hasValue } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";
import { matchPath, useLocation } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";

type TSessionStatus = IOrchestSession["status"];

const ENDPOINT = "/catch/api-proxy/api/sessions/";

const lowerCaseFirstLetter = (str: string) =>
  str.charAt(0).toLowerCase() + str.slice(1);

function convertKeyToCamelCase<T>(data: T | undefined, keys?: string[]) {
  if (!data) return data;
  if (keys) {
    for (const key of keys) {
      data[lowerCaseFirstLetter(pascalcase(key))] = data[key];
    }
    return data as T;
  }
  return Object.entries(data).reduce((newData, curr) => {
    const [key, value] = curr;
    return {
      ...newData,
      [lowerCaseFirstLetter(pascalcase(key))]: value,
    };
  }, {}) as T;
}

/**
 * NOTE: useSessionsPoller should only be placed in HeaderBar
 */
export const useSessionsPoller = () => {
  const { dispatch } = useSessionsContext();
  const { setAlert } = useAppContext();
  const {
    state: { pipeline, pipelineIsReadOnly },
  } = useProjectsContext();

  const location = useLocation();

  // add the view paths that requires polling sessions
  const matchRooViews = matchPath(location.pathname, [
    siteMap.configureJupyterLab.path,
  ]);
  const matchPipelineViews = matchPath(location.pathname, [
    siteMap.pipelineSettings.path,
    siteMap.logs.path,
    siteMap.pipeline.path,
    siteMap.jupyterLab.path,
  ]);

  // sessions are only needed when both conditions are met
  // 1. in the ConfigureJupyterLabView (they are root views without a pipeline_uuid)
  // 2. in the above views AND pipelineUuid is given AND is not read-only
  const shouldPoll =
    matchRooViews?.isExact ||
    (!pipelineIsReadOnly && hasValue(pipeline) && matchPipelineViews?.isExact);

  const { cache } = useSWRConfig();

  const { data, error, mutate } = useSWR<{
    sessions: (IOrchestSession & {
      project_uuid: string;
      pipeline_uuid: string;
    })[];
    status: TSessionStatus;
  }>(shouldPoll ? ENDPOINT : null, fetcher, {
    // We cannot poll conditionally, e.g. only poll if a session status is transitional, e.g. LAUNCHING, STOPPING
    // the reason is that Orchest session is not a user session, but a session of a pipeline.
    // and Orchest sessions are not bound to a single user, therefore
    // this session (i.e. pipeline session) is used by potentially multiple users
    // in order to facilitate multiple users working at the same time, FE needs to check pipeline sessions at all times
    refreshInterval: 1000,
  });

  React.useEffect(() => {
    if (shouldPoll) mutate();
  }, [location, shouldPoll, mutate]);

  const isLoading = !data && !error;

  React.useEffect(() => {
    if (error) {
      setAlert("Error", "Unable to fetch sessions.");
      console.error("Unable to fetch sessions", error);
    }
  }, [error, setAlert]);

  const sessions: IOrchestSession[] | undefined = React.useMemo(() => {
    return (
      data?.sessions.map((session) =>
        convertKeyToCamelCase(session, ["project_uuid", "pipeline_uuid"])
      ) || cache.get(ENDPOINT)?.sessions // in case sessions are needed when polling is not active
    );
  }, [data, cache]);

  React.useEffect(() => {
    dispatch({
      type: "SET_SESSIONS",
      payload: {
        sessions: sessions,
        sessionsIsLoading: isLoading,
      },
    });
  }, [sessions, dispatch, isLoading]);
};
