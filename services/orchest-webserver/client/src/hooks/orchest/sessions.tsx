import * as React from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/fetcher";
import { useOrchest } from "./context";
import { isSession } from "./utils";
import type { IOrchestSessionUuid, IOrchestSession } from "@/types";

type TSessionStatus = IOrchestSession["status"];

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/* Matchers
  =========================================== */

const isLaunchable = (status: TSessionStatus) => !status;

const isStoppable = (status: TSessionStatus) =>
  ["RUNNING", "LAUNCHING"].includes(status);

const isWorking = (status: TSessionStatus) =>
  ["LAUNCHING", "STOPPING"].includes(status);

/* Fetchers
  =========================================== */

const stopSession = ({ pipeline_uuid, project_uuid }: IOrchestSessionUuid) =>
  fetcher([ENDPOINT, project_uuid, "/", pipeline_uuid].join(""), {
    method: "DELETE",
  });

/* Provider
  =========================================== */

export const OrchestSessionsProvider: React.FC = ({ children }) => {
  const { state, dispatch } = useOrchest();

  const { _sessionsIsPolling } = state;

  /**
   * Use SWR to fetch and cache the data from our sessions endpoint
   *
   * Note: the endpoint does **not** return `STOPPED` sessions. This is handled
   * in a later side-effect.
   */
  const { data, mutate, error } = useSWR(ENDPOINT, fetcher, {
    refreshInterval: _sessionsIsPolling ? 1000 : 0,
  });
  const isLoading = !data && !error;
  const isLoaded = !isLoading;

  if (error) {
    console.error("Unable to fetch sessions", error);
  }

  /**
   * SYNC
   *
   * Push SWR changes to Orchest Context when at least one session exists
   */
  React.useEffect(() => {
    dispatch({
      type: "_sessionsSet",
      payload: { sessions: data?.sessions || [], sessionsIsLoading: isLoading },
    });
  }, [data, isLoading]);

  /**
   * TOGGLE
   */
  React.useEffect(() => {
    /* If the session doesn't exist in the cache, use the toggle payload */
    const session =
      (isLoaded &&
        data?.sessions?.find((dataSession) =>
          isSession(dataSession, state?._sessionsToggle)
        )) ||
      state?._sessionsToggle;

    if (!session) {
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * Any session-specific cache mutations must be made with this helper to
     * ensure we're only mutating the requested session
     */
    const mutateSession = (
      newSessionData?: Partial<IOrchestSession>,
      shouldRevalidate?: boolean
    ) =>
      mutate(
        (cachedData) =>
          newSessionData && {
            ...cachedData,
            sessions: cachedData?.sessions.map((sessionData) =>
              sessionData && isSession(session, sessionData)
                ? { ...sessionData, ...newSessionData }
                : sessionData
            ),
          },
        shouldRevalidate
      );

    /**
     * LAUNCH
     */
    if (isLaunchable(session.status)) {
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
          err.json().then((errorBody) => {
            dispatch({
              type: "alert",
              payload: ["Error while starting the session", errorBody?.message],
            });
          });

          console.error(err);
        });

      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * WORKING
     * Note: Our UI should prevent users from ever seeing this error – e.g. by
     * disabling buttons – but it's here just in case.
     */
    if (isWorking(session.status)) {
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
        .then(() => mutate())
        .catch((err) => {
          console.error(err);
        });
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    dispatch({ type: "_sessionsToggleClear" });
  }, [state._sessionsToggle]);

  /**
   * DELETE ALL
   */
  React.useEffect(() => {
    if (state.sessionsKillAllInProgress !== true || !data) return;

    // Mutate `isStoppable` sessions to "STOPPING"
    mutate(
      (cachedData) => ({
        ...cachedData,
        sessions: cachedData?.sessions.map((sessionValue) => ({
          ...sessionValue,
          status: isStoppable(sessionValue.status)
            ? "STOPPING"
            : sessionValue.status,
        })),
      }),
      false
    );

    // Send delete requests for `isStoppable` sessions
    Promise.all(
      data?.sessions
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

  return <React.Fragment>{children}</React.Fragment>;
};

/* Consumer
  =========================================== */

/**
 * OrchestSessionsConsumer
 *
 * In an ideal scenario, we'd just use the SWR hook directly to only trigger
 * polling where it's used. Unfortunately, that's not an option until all of our
 * codebase has moved away from class-based components.
 *
 * In the meantime, we'll wrap this Component around session-dependent views or
 * components to explicitly trigger polling.
 */
export const OrchestSessionsConsumer: React.FC = ({ children }) => {
  const { dispatch } = useOrchest();

  React.useEffect(() => {
    dispatch({ type: "_sessionsPollingStart" });
    return () => {
      dispatch({ type: "_sessionsPollingClear" });
    };
  }, []);

  return <React.Fragment>{children}</React.Fragment>;
};
