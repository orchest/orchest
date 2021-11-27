import type { IOrchestState, OrchestAction } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { OrchestContext } from "./context";

type OrchestActionCallback = (currentState: IOrchestState) => OrchestAction;
type OrchestContextAction = OrchestAction | OrchestActionCallback;

const reducer = (state: IOrchestState, _action: OrchestContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "pipelineClear":
      return {
        ...state,
        pipeline_uuid: undefined,
        pipelineName: undefined,
      };
    case "pipelineSet":
      return { ...state, pipelineFetchHash: uuidv4(), ...action.payload };
    case "pipelineSetSaveStatus":
      return { ...state, pipelineSaveStatus: action.payload };
    case "pipelineUpdateReadOnlyState":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "projectSet":
      return { ...state, projectUuid: action.payload };
    case "projectsSet":
      return { ...state, projects: action.payload, hasLoadedProjects: true };
    default:
      console.log(action);
      throw new Error();
  }
};

const initialState: IOrchestState = {
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipelineUuid: undefined,
  projectUuid: undefined,
  projects: [],
  hasLoadedProjects: false,
};

export const OrchestProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  return (
    <OrchestContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {children}
    </OrchestContext.Provider>
  );
};
