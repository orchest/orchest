import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import type { PipelineMetaData, Project } from "@/types";
import React from "react";

export const ProjectsContext = React.createContext<IProjectsContext>(null);

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | {
      type: "ADD_PIPELINE";
      payload: PipelineMetaData;
    }
  | {
      type: "UPDATE_PIPELINE";
      payload: Pick<PipelineMetaData, "uuid"> &
        Partial<Omit<PipelineMetaData, "uuid">>;
    }
  | {
      type: "SET_PIPELINES";
      payload: PipelineMetaData[];
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
export interface IProjectsContextState {
  projectUuid?: string;
  pipelineIsReadOnly: boolean;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[];
  pipeline?: PipelineMetaData;
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
    case "ADD_PIPELINE": {
      return {
        ...state,
        pipelines: [...state.pipelines, action.payload],
        pipeline: action.payload,
      };
    }
    case "UPDATE_PIPELINE": {
      const { uuid, ...changes } = action.payload;

      // Always look up `state.pipelines`.
      const targetPipeline = state.pipelines.find(
        (pipeline) => pipeline.uuid === action.payload.uuid
      );

      const updatedPipeline = { ...targetPipeline, ...changes };
      const updatedPipelines = state.pipelines.map((pipeline) =>
        pipeline.uuid === uuid ? updatedPipeline : pipeline
      );
      return {
        ...state,
        pipeline: updatedPipeline,
        pipelines: updatedPipelines,
      };
    }
    case "SET_PIPELINES": {
      const isPipelineRemoved = !action.payload.some(
        (pipeline) => state.pipeline?.path === pipeline.path
      );

      return {
        ...state,
        pipelines: action.payload,
        pipeline: isPipelineRemoved ? action.payload[0] : state.pipeline,
      };
    }
    case "pipelineSetSaveStatus":
      return { ...state, pipelineSaveStatus: action.payload };
    case "SET_PIPELINE_IS_READONLY":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "projectSet":
      return { ...state, projectUuid: action.payload };
    case "projectsSet":
      return { ...state, projects: action.payload, hasLoadedProjects: true };
    default: {
      console.log(action);
      return state;
    }
  }
};

const initialState: IProjectsContextState = {
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipelines: [],
  projects: [],
  hasLoadedProjects: false,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const { pipelines, isFetchingPipelines, error } = useFetchPipelines(
    state.projectUuid
  );

  React.useEffect(() => {
    if (!isFetchingPipelines && !error && pipelines) {
      dispatch({ type: "SET_PIPELINES", payload: pipelines });
    }
  }, [dispatch, pipelines, isFetchingPipelines, error]);

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
