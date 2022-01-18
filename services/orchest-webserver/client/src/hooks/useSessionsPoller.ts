import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { IOrchestSession } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";
import useSWR from "swr";

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
    refreshInterval: 1000,
  });

  const isLoading = !data && !error;

  React.useEffect(() => {
    if (error) {
      setAlert("Error", "Unable to fetch sessions.");
      console.error("Unable to fetch sessions", error);
    }
  }, [error, setAlert]);

  React.useEffect(() => {
    const sessions =
      data?.sessions.map((session) =>
        convertKeyToCamelCase(session, ["project_uuid", "pipeline_uuid"])
      ) || [];

    dispatch({
      type: "SET_SESSIONS",
      payload: {
        sessions: sessions as IOrchestSession[],
        sessionsIsLoading: isLoading,
      },
    });
  }, [data, dispatch, isLoading]);
};
