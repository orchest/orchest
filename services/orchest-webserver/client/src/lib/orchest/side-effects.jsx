// @ts-check
import React from "react";
import useSWR, { useSWRInfinite } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useOrchest } from "./context";

const SessionAPI = (props) => {
  console.log("fart");
  return null;
};

/** @type {React.FC} */
export const OrchestSideEffects = ({ children }) => {
  // @ts-ignore
  const orchest = window.orchest;

  const { state, dispatch } = useOrchest();
  const [shouldFetchSession, setShouldFetchSession] = React.useState(false);

  /**
   * Alerts
   */
  React.useEffect(() => {
    if (state.alert) {
      orchest.alert(...state.alert);
    }
  }, [state]);

  /**
   * Session Fetches
   */
  useSWR(
    shouldFetchSession
      ? [
          `/catch/api-proxy/api/sessions/?project_uuid=`,
          state?._sessionApi.session?.project_uuid,
          `&pipeline_uuid=`,
          state?._sessionApi.session?.pipeline_uuid,
        ].join("")
      : null,
    fetcher,
    {
      onError: (e) => {
        if (!e.isCanceled) console.log(e);

        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            operation: state._sessionApi.operation,
            status: "ERROR",
          },
        });
      },
      onSuccess: (data) => {
        console.log("updated data ", data);
        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            operation: state._sessionApi.operation,
            status: "SUCCESS",
            session: {
              ...(data?.sessions?.length > 0
                ? data.sessions[0]
                : { status: "STOPPED" }),
              project_uuid: state?._sessionApi.session?.project_uuid,
              pipeline_uuid: state?._sessionApi.session?.pipeline_uuid,
            },
          },
        });
        setShouldFetchSession(false);
      },
    }
  );

  /**
   * Session Launches and Deletions
   */
  React.useEffect(() => {
    if (!state._sessionApi?.status || !state._sessionApi?.operation) {
      return;
    }

    if (state._sessionApi?.operation === "READ") {
      setShouldFetchSession(true);
    }

    if (state._sessionApi?.operation === "LAUNCH") {
      console.log("launching session");

      fetcher("/catch/api-proxy/api/sessions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({
          pipeline_uuid: state.pipeline_uuid,
          project_uuid: state.project_uuid,
        }),
      })
        .then((sessionDetails) => {
          console.log("value =", sessionDetails);

          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state?._sessionApi,
              status: "SUCCESS",
              session: { ...state?._sessionApi.session, ...sessionDetails },
            },
          });
        })
        .catch((err) => {
          if (!err.isCancelled) {
            console.log("Error during request LAUNCHing to orchest-api.");
            console.log(err);

            let error = JSON.parse(err.body);
            if (error.message == "MemoryServerRestartInProgress") {
              orchest.alert(
                "The session can't be stopped while the memory server is being restarted."
              );
            }
          }

          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state?._sessionApi,
              status: "ERROR",
            },
          });
        });
    }

    if (state._sessionApi.operation === "DELETE") {
      console.log("deleting session");

      fetcher(
        "/catch/api-proxy/api/sessions/${state.project_uuid}/${state.pipeline_uuid}",
        {
          method: "DELETE",
        }
      )
        .then(() =>
          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state._sessionApi,
              status: "SUCCESS",
              session: {
                ...state._sessionApi.session,
                status: "STOPPED",
              },
            },
          })
        )
        .catch((err) => {
          if (!err.isCancelled) {
            console.log(
              "Error during request DELETEing launch to orchest-api."
            );
            console.log(err);

            if (err?.message === "MemoryServerRestartInProgress") {
              orchest.alert(
                "The session can't be stopped while the memory server is being restarted."
              );
            }

            if (err === undefined || (err && err.isCanceled !== true)) {
              dispatch({
                type: "_sessionApiUpdate",
                payload: {
                  ...state._sessionApi,
                  status: "ERROR",
                },
              });
            }
          }
        });
    }
  }, [state._sessionApi]);

  return <React.Fragment>{children}</React.Fragment>;
};
