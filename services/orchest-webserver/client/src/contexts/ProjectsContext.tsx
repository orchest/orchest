import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  Example,
  PipelineMetaData,
  Project,
  ReducerActionWithCallback,
} from "@/types";
import React from "react";

const ProjectsContext = React.createContext<IProjectsContext>(
  {} as IProjectsContext
);

export type IProjectsContextState = {
  projectUuid?: string;
  pipelineIsReadOnly: boolean;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[] | undefined;
  pipeline: PipelineMetaData | undefined;
  projects: Project[] | undefined;
  examples: Example[] | undefined;
  hasLoadedProjects: boolean;
  hasLoadedPipelinesInPipelineEditor: boolean;
  newPipelineUuid: string | undefined;
};

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | {
      type: "ADD_PIPELINE";
      payload: PipelineMetaData;
    }
  | {
      type: "SET_PIPELINES";
      payload: PipelineMetaData[] | undefined;
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
      type: "SET_EXAMPLES";
      payload: Example[];
    }
  | {
      type: "SET_PIPELINE_IS_READONLY";
      payload: boolean;
    }
  | {
      type: "UPDATE_PIPELINE";
      payload: { uuid: string } & Partial<PipelineMetaData>;
    };

export type ProjectsContextAction = ReducerActionWithCallback<
  IProjectsContextState,
  Action
>;

export interface IProjectsContext {
  state: IProjectsContextState;
  dispatch: (value: ProjectsContextAction) => void;
}

const initialState: IProjectsContextState = {
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipelines: undefined,
  pipeline: undefined,
  projects: undefined,
  examples: undefined,
  hasLoadedProjects: false,
  hasLoadedPipelinesInPipelineEditor: false,
  newPipelineUuid: undefined,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  // Read and write localstorage in the context to ensure that the state
  // is updated synchronosely.
  const [lastSeenProjectUuid, setlastSeenProjectUuid] = useLocalStorage<string>(
    "pipelineEditor.lastSeenProjectUuid",
    ""
  );
  const [lastSeenPipelines, setlastSeenPipelines] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipelines", {});

  const setLastSeenPipeline = React.useCallback(
    (projectUuid: string | undefined, pipelineUuid: string | null) => {
      if (!projectUuid) return;
      setlastSeenPipelines((current) => {
        if (!pipelineUuid) {
          delete current[projectUuid];
          return current;
        }
        if (current[projectUuid] === pipelineUuid) return current;
        return { ...current, [projectUuid]: pipelineUuid };
      });
    },
    [setlastSeenPipelines]
  );

  const cleanProjectsFromLocalstorage = React.useCallback(
    (projects: Project[]) => {
      const currentProjectUuids = new Set(
        projects.map((project) => project.uuid)
      );
      setlastSeenPipelines((current) => {
        if (!current) return {};

        return Object.entries(current).reduce(
          (all, [persistedProjectUuid, persistedPipelineUuid]) => {
            return currentProjectUuids.has(persistedProjectUuid)
              ? { ...all, [persistedProjectUuid]: persistedPipelineUuid }
              : all;
          },
          {} as Record<string, string>
        );
      });
    },
    [setlastSeenPipelines]
  );

  const stringifiedLastSeenPipelines = React.useMemo(
    () => JSON.stringify(lastSeenPipelines),
    [lastSeenPipelines]
  );

  const memoizedReducer = React.useCallback(
    (state: IProjectsContextState, _action: ProjectsContextAction) => {
      const action = _action instanceof Function ? _action(state) : _action;

      switch (action.type) {
        case "ADD_PIPELINE": {
          setLastSeenPipeline(state.projectUuid, action.payload.uuid);
          return {
            ...state,
            pipelines: state.pipelines
              ? [...state.pipelines, action.payload]
              : [action.payload],
            pipeline: action.payload,
            newPipelineUuid: action.payload.uuid,
          };
        }
        case "UPDATE_PIPELINE": {
          const { uuid, ...changes } = action.payload;
          const currentPipelines = state.pipelines || [];

          // Always look up `state.pipelines`.
          const targetPipeline = currentPipelines.find(
            (pipeline) => pipeline.uuid === uuid
          );

          setLastSeenPipeline(state.projectUuid, targetPipeline?.uuid || null);
          if (!targetPipeline) return { ...state, pipeline: undefined };

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
          const cachedPipelineUuid = lastSeenPipelines[state.projectUuid || ""];
          const found = action.payload.find(
            (pipeline) => pipeline.uuid === cachedPipelineUuid
          );
          const targetPipeline = found || action.payload[0];

          setLastSeenPipeline(state.projectUuid, targetPipeline?.uuid);

          return {
            ...state,
            pipelines: action.payload,
            pipeline: targetPipeline,
            hasLoadedPipelinesInPipelineEditor: true,
          };
        }
        case "SET_PIPELINES": {
          if (!action.payload)
            return {
              ...state,
              pipelines: undefined,
              pipeline: undefined,
              hasLoadedPipelinesInPipelineEditor: false,
            };

          const isCurrentPipelineRemoved = !action.payload.some(
            (pipeline) => state.pipeline?.path === pipeline.path
          );

          setLastSeenPipeline(
            state.projectUuid,
            action.payload[0]?.uuid || null
          );

          return {
            ...state,
            pipelines: action.payload,
            pipeline: isCurrentPipelineRemoved
              ? action.payload[0]
              : state.pipeline,
            hasLoadedPipelinesInPipelineEditor: true,
          };
        }
        case "SET_PIPELINE_SAVE_STATUS":
          return { ...state, pipelineSaveStatus: action.payload };
        case "SET_PIPELINE_IS_READONLY":
          return { ...state, pipelineIsReadOnly: action.payload };
        case "SET_PROJECT": {
          if (!action.payload) {
            setlastSeenProjectUuid("");
            return {
              ...state,
              projectUuid: undefined,
              pipelines: undefined,
              pipeline: undefined,
              hasLoadedPipelinesInPipelineEditor: false,
            };
          }
          // Ensure that projectUuid is valid in the state.
          // So that we could show proper warnings in case user provides
          // an invalid projectUuid from the route args.
          const foundProject = (state.projects || []).find(
            (project) => project.uuid === action.payload
          );

          setlastSeenProjectUuid(foundProject ? foundProject.uuid : "");
          if (!foundProject) return state;
          return {
            ...state,
            projectUuid: foundProject.uuid,
            pipelines: undefined,
            pipeline: undefined,
            hasLoadedPipelinesInPipelineEditor: false,
          };
        }
        case "SET_PROJECTS": {
          cleanProjectsFromLocalstorage(action.payload);
          const initialProjectUuid = action.payload.some(
            (project) => project.uuid === lastSeenProjectUuid
          )
            ? lastSeenProjectUuid
            : action.payload[0]?.uuid;

          if (initialProjectUuid !== lastSeenProjectUuid)
            setlastSeenProjectUuid(initialProjectUuid);

          return {
            ...state,
            projects: action.payload,
            projectUuid: initialProjectUuid,
            hasLoadedProjects: true,
          };
        }

        case "SET_EXAMPLES": {
          return { ...state, examples: action.payload };
        }
        default: {
          console.log("Unknown action in ProjectsContext: ", action);
          return state;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      cleanProjectsFromLocalstorage,
      setLastSeenPipeline,
      stringifiedLastSeenPipelines, // lastSeenPipelines should be stringified to prevent unnecessary rerender.
    ]
  );
  const [state, dispatch] = React.useReducer(memoizedReducer, initialState);

  return (
    <ProjectsContext.Provider value={{ state, dispatch }}>
      {children}
    </ProjectsContext.Provider>
  );
};
