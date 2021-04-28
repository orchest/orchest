import React from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { isSession } from "../reducer";
import { useOrchest } from "../context";

const sessionEndpoint = "/catch/api-proxy/api/sessions/";
const sessionKey = ({ pipeline_uuid, project_uuid }) =>
  [
    sessionEndpoint,
    "?project_uuid=",
    project_uuid,
    "&pipeline_uuid=",
    pipeline_uuid,
  ].join("");

const handleSessionSuccess = (session, data) =>
  data?.sessions?.length > 0
    ? { well: "it worked", ...data.sessions[0] }
    : { ...session, status: "STOPPED" };

/**
 * @param {import('@/types').IOrchestState} state
 * @returns
 */
export const useSessions = (state) => {
  const sessionsToFetch = state?._useSessionsUuids;

  const sessionsKey = [
    sessionEndpoint,
    sessionsToFetch
      ?.map((session) => Object.keys(session).map((key) => session[key]))
      .toString(),
  ].join("");

  const { data, mutate, error } = useSWR(
    sessionsToFetch ? sessionsKey : null,
    () =>
      Promise.all(
        sessionsToFetch.map(({ pipeline_uuid, project_uuid }) =>
          fetcher(sessionKey({ pipeline_uuid, project_uuid }))
            .then((value) => {
              const data = handleSessionSuccess(
                { pipeline_uuid, project_uuid },
                value
              );

              return data;
            })
            .catch((e) => console.error("sessions error", e))
        )
      ).then((values) => values)
  );

  React.useEffect(() => {
    const session = data?.find((dataSession) => {
      return isSession(dataSession, state?._useSessionsToggle);
    });

    if (!session) {
      console.error("Session not found");
      return;
    }

    // Launch!
    if (!session.status || !session?.status === "STOPPED") {
      // trigger launch
      return;
    }

    // Wait up
    if (["STARTING", "STOPPING"].includes(session.status)) {
      const alertMessage = [
        "Error",
        "Please wait, the pipeline session is still " +
          { STARTING: "launching", STOPPING: "shutting down" }[
            sessionToToggle.status
          ] +
          ".",
      ];

      // @TODO Replace with dialog
      alert(alertMessage);
      return;
    }

    // Stop!
    if (session.status === "RUNNING") {
      return;
    }

    console.log("toggle session", session);
  }, [state._useSessionsToggle]);

  return {
    sessions: data,
  };
};
