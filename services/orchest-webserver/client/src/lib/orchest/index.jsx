// @ts-check
import {
  uuidv4,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import * as React from "react";

/**
 * @type {import("./types").TOrchestState}
 */
const initialState = {
  isLoading: true,
  // @TODO ADD BROWSERCONFIG CHECK (from App.jsx)
  drawerIsOpen: true,
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipeline_uuid: undefined,
  project_uuid: undefined,
  sessionActive: false,
  viewCurrent: "pipeline",
};

/**
 * @param {*} state
 * @param {import("./types").TOrchestAction} action
 * @returns
 */
function reducer(state, action) {
  // @ts-ignore
  const orchest = window.orchest;
  const sessionPromiseManager = new PromiseManager();

  switch (action.type) {
    case "isLoaded":
      return { ...state, isLoading: false };
    case "drawerToggle":
      // @TODO HANDLE BROSWERCONFIG CHECK
      return { ...state, drawerIsOpen: !state.drawerIsOpen };
    case "pipelineClear":
      return {
        ...state,
        pipeline_uuid: undefined,
        project_uuid: undefined,
        pipelineName: undefined,
      };
    case "pipelineSet":
      return { ...state, pipelineFetchHash: uuidv4(), ...action.payload };
    case "pipelineSetSaveStatus":
      return { ...state, pipelineSaveStatus: action.payload };
    case "pipelineUpdateReadOnlyState":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "sessionCancelPromises":
      sessionPromiseManager.cancelCancelablePromises();
      return { ...state };
    case "sessionSetListeners":
      return { ...state, ...action.payload };
    case "sessionClearListeners":
      return {
        ...state,
        onSessionStageChange: undefined,
        onSessionShutdown: undefined,
        onSessionFetch: undefined,
      };
    case "sessionToggle":
      if (state.sessionWorking) {
        let statusText = "launching";
        if (state.sessionRunning) {
          statusText = "shutting down";
        }
        orchest.alert(
          "Error",
          "Please wait, the pipeline session is still " + statusText + "."
        );
        return;
      }

      if (!state.sessionRunning) {
        // send launch request to API
        let data = {
          pipeline_uuid: state.pipeline_uuid,
          project_uuid: state.project_uuid,
        };

        state?.onSessionStateChange(true, state.sessionRunning);

        let launchPromise = makeCancelable(
          makeRequest("POST", "/catch/api-proxy/api/sessions/", {
            type: "json",
            content: data,
          }),
          sessionPromiseManager
        );

        launchPromise.promise
          .then((response) => {
            let session_details = JSON.parse(response);

            const updatedState = {
              sessionWorking: false,
              sessionRunning: true,
            };

            state?.onSessionStateChange(
              updatedState.sessionWorking,
              updatedState.sessionRunning,
              session_details
            );

            return { ...state, ...updatedState };
          })
          .catch((e) => {
            if (!e.isCanceled) {
              let error = JSON.parse(e.body);
              if (error.message == "JupyterBuildInProgress") {
                orchest.alert(
                  "Error",
                  "Cannot start session. A JupyterLab build is still in progress."
                );
              }

              const updatedState = {
                sessionWorking: false,
                sessionRunning: false,
              };

              state?.onSessionStateChange(
                updatedState.sessionWorking,
                updatedState.sessionRunning
              );

              return { ...state, ...updatedState };
            }
          });
      } else {
        state?.onSessionStateChange(true, state.sessionRunning);
        state?.onSessionShutdown();

        let deletePromise = makeCancelable(
          makeRequest(
            "DELETE",
            `/catch/api-proxy/api/sessions/${state.project_uuid}/${state.pipeline_uuid}`
          ),
          sessionPromiseManager
        );

        deletePromise.promise
          .then(() => {
            const updatedState = {
              sessionWorking: false,
              sessionRunning: false,
            };

            state?.onSessionStateChange(
              updatedState.sessionWorking,
              updatedState.sessionRunning
            );

            return { ...state, ...updatedState };
          })
          .catch((err) => {
            if (!err.isCanceled) {
              console.log(
                "Error during request DELETEing launch to orchest-api."
              );
              console.log(err);

              let error = JSON.parse(err.body);
              if (error.message == "MemoryServerRestartInProgress") {
                orchest.alert(
                  "The session can't be stopped while the memory server is being restarted."
                );
              }

              if (err === undefined || (err && err.isCanceled !== true)) {
                const updatedState = {
                  sessionWorking: false,
                  sessionRunning: true,
                };

                state?.onSessionStateChange(
                  updatedState.sessionWorking,
                  updatedState.sessionRunning
                );

                return { ...state, ...updatedState };
              }
            }
          });
      }

      return { ...state };
    case "viewUpdateCurrent":
      return { ...state, viewCurrent: action.payload };
    default:
      throw new Error();
  }
}

export const OrchestContext = React.createContext(null);

export const OrchestProvider = ({ config, user_config, children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(() => {
    if (config && user_config) {
      dispatch({ type: "isLoaded" });
    }
  }, [config, user_config]);

  return (
    <OrchestContext.Provider value={{ state, dispatch }}>
      {children}
    </OrchestContext.Provider>
  );
};
