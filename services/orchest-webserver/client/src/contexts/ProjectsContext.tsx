import type { IProjectsContext, IProjectsContextState, Project } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";

export const ProjectsContext = React.createContext<IProjectsContext>(null);

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | { type: "pipelineClear" }
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
      type: "pipelineUpdateReadOnlyState";
      payload: IProjectsContextState["pipelineIsReadOnly"];
    };

type ActionCallback = (currentState: IProjectsContextState) => Action;
type ProjectsContextAction = Action | ActionCallback;

const reducer = (
  state: IProjectsContextState,
  _action: ProjectsContextAction
) => {
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
