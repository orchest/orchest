import type { IOrchestSession, Project } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";

export const ProjectsContext = React.createContext<IProjectsContext>(null);

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | {
      type: "pipelineSet";
      payload: Partial<
        Pick<
          IProjectsContextState,
          "pipelineUuid" | "projectUuid" | "pipelineName"
        >
      >;
    }
  | {
      type: "pipelineSetSaveStatus";
      payload: IProjectsContextState["pipelineSaveStatus"];
    }
  | {
      type: "projectSet";
      payload: IProjectsContextState["projectUuid"];
    }
  | {
      type: "projectsSet";
      payload: Project[];
    }
  | {
      type: "SET_PIPELINE_IS_READONLY";
      payload: boolean;
    };

type ActionCallback = (currentState: IProjectsContextState) => Action;
type ProjectsContextAction = Action | ActionCallback;
export interface IProjectsContextState
  extends Pick<
    Omit<IOrchestSession, "pipeline_uuid" | "project_uuid">,
    "projectUuid" | "pipelineUuid"
  > {
  pipelineName?: string;
  pipelineFetchHash?: string;
  pipelineIsReadOnly: boolean;
  pipelineSaveStatus: "saved" | "saving";
  projects: Project[];
  hasLoadedProjects: boolean;
}
export interface IProjectsContext {
  state: IProjectsContextState;
  dispatch: (value: ProjectsContextAction) => void;
}

const reducer = (
  state: IProjectsContextState,
  _action: ProjectsContextAction
) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "pipelineSet":
      return { ...state, pipelineFetchHash: uuidv4(), ...action.payload };
    case "pipelineSetSaveStatus":
      return { ...state, pipelineSaveStatus: action.payload };
    case "SET_PIPELINE_IS_READONLY":
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

const initialState: IProjectsContextState = {
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipelineUuid: undefined,
  projectUuid: undefined,
  projects: [],
  hasLoadedProjects: false,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  return (
    <ProjectsContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};
