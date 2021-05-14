// @ts-check
import React from "react";
import useSWR, { cache } from "swr";
import { fetcher } from "@/utils/fetcher";
import { useOrchest } from "./context";
import { isSession } from "./utils";

/**
 * @typedef {import("@/types").IOrchestSessionUuid } IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 */

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/** @param {IOrchestSessionUuid} props */
const getSessionEndpoint = ({ pipeline_uuid, project_uuid }) =>
  [
    ENDPOINT,
    "?project_uuid=",
    project_uuid,
    "&pipeline_uuid=",
    pipeline_uuid,
  ].join("");

/**
 * @param {IOrchestSessionUuid} props
 */
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

  /* [1] */
  const sessionsKey = [
    ENDPOINT,
    sessionsToFetch
      ?.map((session) => Object.keys(session).map((key) => session[key]))
      .toString(),
  ].join("");

  const { data, mutate, error } = useSWR(
    sessionsToFetch ? sessionsKey : null,
    () => {
      const cachedSessions = cache.get(sessionsKey);
      /* [2] */
      return Promise.all(
        sessionsToFetch.map(({ pipeline_uuid, project_uuid }) => {
          const key = getSessionEndpoint({ pipeline_uuid, project_uuid });

          const cachedSession = cachedSessions?.find((session) =>
            isSession(session, { pipeline_uuid, project_uuid })
          );

          /* Ensure only "LAUNCHING" and "STOPPING" statuses are polled */
          if (["RUNNING", "STOPPED"].includes(cachedSession?.status)) {
            return cachedSession;
          }

          return fetcher(key)
            .then((value) =>
              value?.sessions?.length > 0
                ? value.sessions[0]
                : { pipeline_uuid, project_uuid, status: "STOPPED" }
            )
            .catch((e) => {
              console.error(e);
            });
        })
      ).then(
        /** @param {IOrchestSession[]} values */
        (values) => values
      );
    },
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
   * Push SWR sessions to the Orchest Context
   */
  React.useEffect(() => {
    dispatch({ type: "_sessionsSet", payload: data });
  }, [data]);

  /**
   * Handle `sessionsKillAll`
   */
  React.useEffect(() => {
    if (state.sessionsKillAllInProgress !== true) return;

    fetcher(ENDPOINT)
      .then((values) => {
        if (!values.sessions) {
          return;
        }

        mutate(
          values.sessions.map((sessionValue) => ({
            ...sessionValue,
            status: ["STOPPED", "STOPPING"].includes(sessionValue?.status)
              ? sessionValue.status
              : "STOPPING",
          })),
          false
        );

        Promise.all(
          values.sessions.map((sessionData) => stopSession(sessionData))
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
    if (session.status === "RUNNING") {
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
