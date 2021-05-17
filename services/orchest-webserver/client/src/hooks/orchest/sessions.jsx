// @ts-check
import React from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/fetcher";
import { useOrchest } from "./context";
import { isSession } from "./utils";

/**
 * @typedef {import("@/types").IOrchestSessionUuid } IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 */

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/**  @param {IOrchestSession['status']} status */
const isStoppable = (status) => ["RUNNING", "LAUNCHING"].includes(status);

/**  @param {IOrchestSessionUuid} props */
const stopSession = ({ pipeline_uuid, project_uuid }) =>
  fetcher([ENDPOINT, project_uuid, "/", pipeline_uuid].join(""), {
    method: "DELETE",
  });

/**
 * SessionsProvider
 */
export const SessionsProvider = ({ children }) => {
  const { state, dispatch } = useOrchest();
  const [isPolling, setIsPolling] = React.useState(false);

  const sessionsToFetch = state?._sessionsUuids;

  /**
   * SWR is designed to fetch data from endpoints in a parallel/async manner,
   * but as our flask server only supports one request at-a-time in dev mode we
   * have to do things slightly differently
   *
   * Our implementation works as follows:
   * 1. Creates a unique cache key for *all* our current sessions
   * 2. Uses Promise.all to batch *all* responses into a single sessions array.
   */
  const { data, mutate, error } = useSWR(
    sessionsToFetch.length > 0 ? ENDPOINT : null,
    (...args) => fetcher(...args).then((value) => value.sessions || []),
    {
      onSuccess: (values) => {
        const hasWorkingSession = values.find((value) =>
          ["LAUNCHING", "STOPPING"].includes(value.status)
        );

        const shouldPoll =
          typeof hasWorkingSession === "undefined" ? false : true;

        setIsPolling(shouldPoll);
      },
      refreshInterval: isPolling ? 1000 : 0,
    }
  );

  if (error) {
    console.error("Unable to fetch sessions");
  }

  /**
   * Sync SWR sessions to the Orchest Context
   */
  React.useEffect(() => {
    dispatch({ type: "_sessionsSet", payload: data });
  }, [data]);

  /**
   * Handle new sessions
   *
   * Add new sessions to the SWR cache that don't already exist in the endpoint
   * (e.g. if they're `STOPPED`)
   */
  React.useEffect(() => {
    if (data && sessionsToFetch.length > 0) {
      mutate((cache) => {
        const nonexistentSessionsToFetch = sessionsToFetch.filter(
          (session) =>
            typeof cache.find((sessionFetched) =>
              isSession(session, sessionFetched)
            ) === "undefined"
        );

        return [].concat(cache, nonexistentSessionsToFetch).map((session) => ({
          ...session,
          status: session.status || "STOPPED",
        }));
      }, false);
    }
  }, [data, sessionsToFetch]);

  /**
   * Handle `sessionsKillAll`
   */
  React.useEffect(() => {
    if (state.sessionsKillAllInProgress !== true || !data) return;

    // Mutate `isStoppable` sessions to "STOPPING"
    mutate(
      data.map((sessionValue) => ({
        ...sessionValue,
        status: isStoppable(sessionValue.status)
          ? "STOPPING"
          : sessionValue.status,
      })),
      false
    );

    // Send delete requests for `isStoppable` sessions
    Promise.all(
      data
        .filter((sessionData) => isStoppable(sessionData.status))
        .map((sessionData) => stopSession(sessionData))
    )
      .then(() => {
        mutate();
        dispatch({
          type: "_sessionsKillAllClear",
        });
      })
      .catch((err) => {
        console.error("Unable to stop all sessions", err);
        dispatch({
          type: "_sessionsKillAllClear",
        });
      });
  }, [state.sessionsKillAllInProgress]);

  /**
   * Handle Toggle Events
   */
  React.useEffect(() => {
    const session = data?.find((dataSession) => {
      return isSession(dataSession, state?._sessionsToggle);
    });

    if (!session) {
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * Any cache mutations must be made with this helper to ensure we're only
     * mutating the requested session
     * @param {Partial<IOrchestSession>} [newSessionData]
     * @param {boolean} [shouldRevalidate]
     * @returns
     */
    const mutateSession = (newSessionData, shouldRevalidate) =>
      mutate(
        (sessionsData) =>
          newSessionData &&
          sessionsData.map((sessionData) =>
            isSession(session, sessionData)
              ? { ...sessionData, ...newSessionData }
              : sessionData
          ),
        shouldRevalidate
      );

    /**
     * LAUNCH
     */
    if (!session.status || session.status === "STOPPED") {
      mutateSession({ status: "LAUNCHING" }, false);

      fetcher(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({
          pipeline_uuid: session.pipeline_uuid,
          project_uuid: session.project_uuid,
        }),
      })
        .then((sessionDetails) => mutateSession(sessionDetails))
        .catch((err) => {
          let errorBody = JSON.parse(err.body);
          if (errorBody?.message == "MemoryServerRestartInProgress") {
            dispatch({
              type: "alert",
              payload: [
                "The session can't be launched while the memory server is being restarted.",
              ],
            });
          } else {
            console.error(err);
          }
        });

      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * WORKING
     * Note: Our UI should prevent users from ever seeing this error – e.g. by
     * disabling buttons – but it's here just in case.
     */
    if (["STARTING", "STOPPING"].includes(session.status)) {
      dispatch({
        type: "alert",
        payload: [
          "Error",
          "Please wait, the pipeline session is still " +
            { STARTING: "launching", STOPPING: "shutting down" }[
              session.status
            ] +
            ".",
        ],
      });
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * DELETE
     */
    if (isStoppable(session.status)) {
      mutateSession({ status: "STOPPING" }, false);

      stopSession(session)
        .then(() => mutateSession())
        .catch((err) => {
          if (err?.message === "MemoryServerRestartInProgress") {
            dispatch({
              type: "alert",
              payload: [
                "The session can't be stopped while the memory server is being restarted.",
              ],
            });
          } else {
            console.error(err);
          }
        });
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    dispatch({ type: "_sessionsToggleClear" });
  }, [state._sessionsToggle]);

  return <React.Fragment>{children}</React.Fragment>;
};
