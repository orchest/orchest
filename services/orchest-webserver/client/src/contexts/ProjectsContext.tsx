import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { useHasChanged } from "@/hooks/useHasChanged";
import type { PipelineMetaData, Project } from "@/types";
import React from "react";
import { KeyedMutator } from "swr";

const ProjectsContext = React.createContext<IProjectsContext>(
  {} as IProjectsContext
);

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | {
      type: "ADD_PIPELINE";
      payload: PipelineMetaData;
    }
  | {
      type: "SET_HAS_LOADED_PIPELINES";
      payload: boolean;
    }
  | {
      type: "SET_PIPELINES";
      payload: PipelineMetaData[];
    }
  | {
      type: "LOAD_PIPELINES";
      payload: PipelineMetaData[];
    }
  | {
      type: "SET_PIPELINE_SAVE_STATUS";
      payload: IProjectsContextState["pipelineSaveStatus"];
    }
  | {
      type: "SET_PROJECT";
      payload: IProjectsContextState["projectUuid"];
    }
  | {
      type: "SET_PROJECTS";
      payload: Project[];
    }
  | {
      type: "SET_PIPELINE_IS_READONLY";
      payload: boolean;
    }
  | {
      type: "UPDATE_PIPELINE";
      payload: { uuid: string } & Partial<PipelineMetaData>;
    };

type ActionCallback = (currentState: IProjectsContextState) => Action;
type ProjectsContextAction = Action | ActionCallback;
export interface IProjectsContextState {
  projectUuid?: string;
  pipelineIsReadOnly: boolean;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[] | undefined;
  pipeline?: PipelineMetaData | undefined;
  projects: Project[];
  hasLoadedProjects: boolean;
  hasLoadedPipelinesInPipelineEditor: boolean;
}
export interface IProjectsContext {
  state: IProjectsContextState;
  dispatch: (value: ProjectsContextAction) => void;
  fetchPipelines: KeyedMutator<PipelineMetaData[]>;
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
        pipelines: state.pipelines
          ? [...state.pipelines, action.payload]
          : [action.payload],
        pipeline: action.payload,
      };
    }
    case "UPDATE_PIPELINE": {
      const { uuid, ...changes } = action.payload;
      const currentPipelines = state.pipelines || [];

      // Always look up `state.pipelines`.
      const targetPipeline =
        currentPipelines.find(
          (pipeline) => pipeline.uuid === action.payload.uuid
        ) || currentPipelines[0];

      if (!targetPipeline) return state;

      const updatedPipeline = { ...targetPipeline, ...changes };
      const updatedPipelines = (state.pipelines || []).map((pipeline) =>
        pipeline.uuid === uuid ? updatedPipeline : pipeline
      );
      return {
        ...state,
        pipeline: updatedPipeline,
        pipelines: updatedPipelines,
      };
    }
    case "LOAD_PIPELINES": {
      return { ...state, pipelines: action.payload };
    }
    case "SET_HAS_LOADED_PIPELINES": {
      return { ...state, hasLoadedPipelinesInPipelineEditor: action.payload };
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
    case "SET_PIPELINE_SAVE_STATUS":
      return { ...state, pipelineSaveStatus: action.payload };
    case "SET_PIPELINE_IS_READONLY":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "SET_PROJECT":
      return {
        ...state,
        projectUuid: action.payload,
        pipelines: undefined,
        pipeline: undefined,
      };
    case "SET_PROJECTS":
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
  pipelines: undefined,
  projects: [],
  hasLoadedProjects: false,
  hasLoadedPipelinesInPipelineEditor: false,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const {
    pipelines,
    isFetchingPipelines,
    error,
    fetchPipelines,
  } = useFetchPipelines(state.projectUuid);

  const hasPipelinesChanged = useHasChanged(state.pipelines);

  React.useEffect(() => {
    // When switching projects, state.pipelines will be cleaned up.
    // then we need to refetch.
    // Note that we don't want to trigger this when page is just loaded.
    // because useFetchPipelines will do the inital request.
    const hasPipelineCleanedUp =
      !isFetchingPipelines && hasPipelinesChanged && !state.pipelines;

    if (hasPipelineCleanedUp) fetchPipelines();
  }, [
    isFetchingPipelines,
    state.pipelines,
    hasPipelinesChanged,
    fetchPipelines,
  ]);

  React.useEffect(() => {
    if (!isFetchingPipelines && !error && pipelines) {
      dispatch({ type: "LOAD_PIPELINES", payload: pipelines });
    }
  }, [dispatch, pipelines, isFetchingPipelines, error]);

  return (
    <ProjectsContext.Provider
      value={{
        state,
        dispatch,
        fetchPipelines,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};
