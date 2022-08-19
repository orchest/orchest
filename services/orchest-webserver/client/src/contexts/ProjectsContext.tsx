import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  EnvironmentValidationData,
  Example,
  PipelineMetaData,
  Project,
  ReducerActionWithCallback,
} from "@/types";
import React from "react";

export enum BUILD_IMAGE_SOLUTION_VIEW {
  PIPELINE = "Pipeline",
  JOBS = "Jobs",
  JOB = "Job",
  JUPYTER_LAB = "JupyterLab",
}

export type BuildRequest = {
  projectUuid: string;
  environmentValidationData: EnvironmentValidationData;
  requestedFromView: string;
  onComplete: () => void;
  onCancel: () => void;
};

export type RequestBuildDispatcher = (
  projectUuid: string,
  environmentValidationData: EnvironmentValidationData,
  requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
) => Promise<boolean>;

const ProjectsContext = React.createContext<IProjectsContext>(
  {} as IProjectsContext
);

export type PipelineReadOnlyReason =
  | "isJobRun"
  | "environmentsNotYetBuilt"
  | "environmentsBuildInProgress"
  | "environmentsFailedToBuild"
  | "JupyterEnvironmentBuildInProgress";

export type ProjectsContextState = {
  projectUuid?: string;
  pipelineReadOnlyReason?: PipelineReadOnlyReason;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[] | undefined;
  pipeline: PipelineMetaData | undefined;
  projects: Project[] | undefined;
  examples: Example[] | undefined;
  hasLoadedProjects: boolean;
  hasLoadedPipelinesInPipelineEditor: boolean;
  newPipelineUuid: string | undefined;
  buildRequest?: BuildRequest;
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
      payload: ProjectsContextState["pipelineSaveStatus"];
    }
  | {
      type: "SET_PROJECT";
      payload: ProjectsContextState["projectUuid"];
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
      type: "SET_PIPELINE_READONLY_REASON";
      payload: PipelineReadOnlyReason | undefined;
    }
  | {
      type: "UPDATE_PIPELINE";
      payload: { uuid: string } & Partial<PipelineMetaData>;
    }
  | {
      type: "SET_BUILD_REQUEST";
      payload: BuildRequest;
    }
  | {
      type: "CANCEL_BUILD_REQUEST";
    }
  | {
      type: "COMPLETE_BUILD_REQUEST";
    };

export type ProjectsContextAction = ReducerActionWithCallback<
  ProjectsContextState,
  Action
>;

export interface IProjectsContext {
  state: ProjectsContextState;
  dispatch: (value: ProjectsContextAction) => void;
  ensureEnvironmentsAreBuilt: (
    requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
  ) => Promise<boolean>;
  requestBuild: RequestBuildDispatcher;
}

const initialState: ProjectsContextState = {
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
  // is updated synchronously.
  const [lastSeenProjectUuid, setLastSeenProjectUuid] = useLocalStorage<string>(
    "pipelineEditor.lastSeenProjectUuid",
    ""
  );
  const [lastSeenPipelines, setLastSeenPipelines] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipelines", {});

  const setLastSeenPipeline = React.useCallback(
    (projectUuid: string | undefined, pipelineUuid: string | null) => {
      if (!projectUuid) return;
      setLastSeenPipelines((current) => {
        if (!pipelineUuid) {
          delete current[projectUuid];
          return current;
        }
        if (current[projectUuid] === pipelineUuid) return current;
        return { ...current, [projectUuid]: pipelineUuid };
      });
    },
    [setLastSeenPipelines]
  );

  const cleanProjectsFromLocalstorage = React.useCallback(
    (projects: Project[]) => {
      const currentProjectUuids = new Set(
        projects.map((project) => project.uuid)
      );
      setLastSeenPipelines((current) => {
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
    [setLastSeenPipelines]
  );

  const stringifiedLastSeenPipelines = React.useMemo(
    () => JSON.stringify(lastSeenPipelines),
    [lastSeenPipelines]
  );

  const memoizedReducer = React.useCallback(
    (state: ProjectsContextState, _action: ProjectsContextAction) => {
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

          const targetPipeline = isCurrentPipelineRemoved
            ? action.payload[0]
            : state.pipeline;

          if (isCurrentPipelineRemoved)
            setLastSeenPipeline(
              state.projectUuid,
              targetPipeline?.uuid || null
            );

          return {
            ...state,
            pipelines: action.payload,
            pipeline: targetPipeline,
            hasLoadedPipelinesInPipelineEditor: true,
          };
        }
        case "SET_PIPELINE_SAVE_STATUS":
          return { ...state, pipelineSaveStatus: action.payload };
        case "SET_PIPELINE_READONLY_REASON":
          return { ...state, pipelineReadOnlyReason: action.payload };
        case "SET_PROJECT": {
          if (!action.payload) {
            setLastSeenProjectUuid("");
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

          setLastSeenProjectUuid(foundProject ? foundProject.uuid : "");
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
            setLastSeenProjectUuid(initialProjectUuid);

          return {
            ...state,
            projects: action.payload,
            projectUuid: initialProjectUuid,
            hasLoadedProjects: true,
          };
        }
        case "SET_BUILD_REQUEST": {
          return { ...state, buildRequest: action.payload };
        }
        case "COMPLETE_BUILD_REQUEST":
          return {
            ...state,
            buildRequest: undefined,
            pipelineReadOnlyReason: undefined,
          };
        case "CANCEL_BUILD_REQUEST":
          return { ...state, buildRequest: undefined };
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

  const requestBuild = React.useCallback(
    (
      projectUuid: string,
      environmentValidationData: EnvironmentValidationData,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      return new Promise<boolean>((resolve) =>
        dispatch({
          type: "SET_BUILD_REQUEST",
          payload: {
            projectUuid,
            environmentValidationData,
            requestedFromView: requestedFromView || "",
            onComplete: () => resolve(true),
            onCancel: () => resolve(false),
          },
        })
      );
    },
    [dispatch]
  );

  const triggerRequestBuild = React.useCallback(
    async (
      environmentValidationData: EnvironmentValidationData | undefined,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      if (!state.projectUuid || !environmentValidationData) return false;

      return requestBuild(
        state.projectUuid,
        environmentValidationData,
        requestedFromView
      );
    },
    [requestBuild, state.projectUuid]
  );

  const { validate } = useEnvironmentsApi();

  const ensureEnvironmentsAreBuilt = React.useCallback(
    async (requestedFromView: BUILD_IMAGE_SOLUTION_VIEW): Promise<boolean> => {
      try {
        const [validationData, buildStatus] = await validate();

        dispatch({
          type: "SET_PIPELINE_READONLY_REASON",
          payload:
            buildStatus === "allEnvironmentsBuilt" ? undefined : buildStatus,
        });

        if (buildStatus === "allEnvironmentsBuilt") return true;
        if (buildStatus === "environmentsBuildInProgress") return false;
        return triggerRequestBuild(validationData, requestedFromView);
      } catch (error) {
        return false;
      }
    },
    [validate, triggerRequestBuild]
  );

  return (
    <ProjectsContext.Provider
      value={{ state, dispatch, ensureEnvironmentsAreBuilt, requestBuild }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};
