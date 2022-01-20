import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { IOrchestSession } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";
import useSWR from "swr";
import useDeepCompareEffect from "use-deep-compare-effect";
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

export const useSessionsPoller = () => {
  const { dispatch } = useSessionsContext();
  const { setAlert } = useAppContext();

  const { data, error } = useSWR<{
    sessions: (IOrchestSession & {
      project_uuid: string;
      pipeline_uuid: string;
    })[];
    status: TSessionStatus;
  }>(ENDPOINT, fetcher, {
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
      ) || []
    );
  }, [data]);

  useDeepCompareEffect(() => {
    dispatch({
      type: "SET_SESSIONS",
      payload: {
        sessions: sessions,
        sessionsIsLoading: isLoading,
      },
    });
  }, [sessions, dispatch, isLoading]);
};
