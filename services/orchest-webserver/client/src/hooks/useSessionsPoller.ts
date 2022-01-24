import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { siteMap } from "@/Routes";
import { IOrchestSession } from "@/types";
import { fetcher, hasValue } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";
import { useRouteMatch } from "react-router-dom";
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
 * useSessionsPoller should only be placed in HeaderBar
 */
export const useSessionsPoller = () => {
  const { dispatch } = useSessionsContext();
  const { setAlert } = useAppContext();
  const {
    state: { pipelineUuid, pipelineIsReadOnly },
  } = useProjectsContext();

  const matchPipelines = useRouteMatch({
    path: siteMap.pipelines.path,
    exact: true,
  });

  // sessions are only needed when
  // 1. pipelineUuid is given, and is not read-only
  // 2. in the pipeline list
  const shouldPoll =
    (!pipelineIsReadOnly && hasValue(pipelineUuid)) || hasValue(matchPipelines);

  const { cache } = useSWRConfig();

  const { data, error } = useSWR<{
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

  const isLoading = !data && !error;

  React.useEffect(() => {
    if (error) {
      setAlert("Error", "Unable to fetch sessions.");
      console.error("Unable to fetch sessions", error);
    }
  }, [error, setAlert]);

  const sessions: IOrchestSession[] = React.useMemo(() => {
    return (
      data?.sessions.map((session) =>
        convertKeyToCamelCase(session, ["project_uuid", "pipeline_uuid"])
      ) ||
      cache.get(ENDPOINT)?.sessions || // in case sessions are needed when polling is not active
      []
    );
  }, [data]);

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
