import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCancelablePromise } from "@/hooks/useCancelablePromise";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  EnvironmentValidationData,
  PipelineMetaData,
  ReducerActionWithCallback,
} from "@/types";
import { FetchError } from "@orchest/lib-utils";
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
) => Promise<true | Error>;

const ProjectsContext = React.createContext<IProjectsContext>(
  {} as IProjectsContext
);

export type PipelineReadOnlyReason =
  | "isSnapshot"
  | "isJobRun"
  | "environmentsNotYetBuilt"
  | "environmentsBuildInProgress"
  | "environmentsFailedToBuild"
  | "JupyterEnvironmentBuildInProgress";

export type ProjectContextState = {
  projectUuid?: string;
  pipelineReadOnlyReason?: PipelineReadOnlyReason;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[] | undefined;
  pipeline: PipelineMetaData | undefined;
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
      payload: ProjectContextState["pipelineSaveStatus"];
    }
  | {
      type: "SET_PROJECT";
      payload: ProjectContextState["projectUuid"];
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
  ProjectContextState,
  Action
>;

export interface IProjectsContext {
  state: ProjectContextState;
  dispatch: (value: ProjectsContextAction) => void;
  ensureEnvironmentsAreBuilt: (
    requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
  ) => Promise<true | Error>;
  requestBuild: RequestBuildDispatcher;
}

const initialState: ProjectContextState = {
  pipelineSaveStatus: "saved",
  pipelines: undefined,
  pipeline: undefined,
  hasLoadedPipelinesInPipelineEditor: false,
  newPipelineUuid: undefined,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const { projects, isLoaded } = useFetchProjects();

  // Read and write localstorage in the context to ensure that the state
  // is updated synchronously.
  const [activeProjectUuid, setActiveProjectUuid] = useLocalStorage<string>(
    "pipelineEditor.lastSeenProjectUuid",
    ""
  );
  const [activePipelines, setActivePipelines] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipelines", {});

  const setActivePipeline = React.useCallback(
    (projectUuid: string | undefined, pipelineUuid: string | null) => {
      if (!projectUuid) return;

      setActivePipelines((active) => {
        if (!pipelineUuid) {
          delete active[projectUuid];
          return active;
        }
        if (active[projectUuid] === pipelineUuid) return active;
        return { ...active, [projectUuid]: pipelineUuid };
      });
    },
    [setActivePipelines]
  );

  React.useEffect(() => {
    if (!isLoaded) return;

    // Prune "active pipelines" from projects that no longer exist.

    setActivePipelines((current) => {
      if (!current) return {};

      return Object.fromEntries(
        Object.entries(current).filter(([projectUuid]) =>
          projects.some((project) => project.uuid === projectUuid)
        )
      );
    });
  }, [projects, isLoaded, setActivePipelines]);

  const stringifiedLastSeenPipelines = React.useMemo(
    () => JSON.stringify(activePipelines),
    [activePipelines]
  );

  const memoizedReducer = React.useCallback(
    (state: ProjectContextState, _action: ProjectsContextAction) => {
      const action = _action instanceof Function ? _action(state) : _action;

      switch (action.type) {
        case "ADD_PIPELINE": {
          setActivePipeline(state.projectUuid, action.payload.uuid);
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

          setActivePipeline(state.projectUuid, targetPipeline?.uuid || null);
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
          const cachedPipelineUuid = activePipelines[state.projectUuid || ""];
          const found = action.payload.find(
            (pipeline) => pipeline.uuid === cachedPipelineUuid
          );
          const targetPipeline = found || action.payload[0];

          setActivePipeline(state.projectUuid, targetPipeline?.uuid);

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
            setActivePipeline(state.projectUuid, targetPipeline?.uuid || null);

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
            setActiveProjectUuid("");
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
          const foundProject = (projects || []).find(
            (project) => project.uuid === action.payload
          );

          setActiveProjectUuid(foundProject ? foundProject.uuid : "");
          if (!foundProject) return state;
          return {
            ...state,
            projectUuid: foundProject.uuid,
            pipelines: undefined,
            pipeline: undefined,
            hasLoadedPipelinesInPipelineEditor: false,
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
        default: {
          console.log("Unknown action in ProjectsContext: ", action);
          return state;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      setActivePipeline,
      stringifiedLastSeenPipelines, // lastSeenPipelines should be stringified to prevent unnecessary rerender.
    ]
  );
  const [state, dispatch] = React.useReducer(memoizedReducer, initialState);

  const { makeCancelable } = useCancelablePromise();
  const requestBuild = React.useCallback(
    (
      projectUuid: string,
      environmentValidationData: EnvironmentValidationData,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      return makeCancelable(
        new Promise<true | Error>((resolve) =>
          dispatch({
            type: "SET_BUILD_REQUEST",
            payload: {
              projectUuid,
              environmentValidationData,
              requestedFromView: requestedFromView || "",
              onComplete: () => resolve(true),
              onCancel: () => resolve(new Error("build request was canceled")),
            },
          })
        )
      );
    },
    [dispatch, makeCancelable]
  );

  const triggerRequestBuild = React.useCallback(
    async (
      environmentValidationData: EnvironmentValidationData | undefined,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      if (!state.projectUuid) return new Error("project UUID unavailable");
      if (!environmentValidationData) return new Error("Unable to validate");

      return requestBuild(
        state.projectUuid,
        environmentValidationData,
        requestedFromView
      );
    },
    [requestBuild, state.projectUuid]
  );

  const validate = useEnvironmentsApi((state) => state.validate);

  const ensureEnvironmentsAreBuilt = React.useCallback(
    async (
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ): Promise<true | Error> => {
      const validatedResults = await validate();
      const [validationData, buildStatus] = validatedResults || [];
      const readOnlyReason =
        buildStatus === "allEnvironmentsBuilt" ? undefined : buildStatus;

      dispatch({
        type: "SET_PIPELINE_READONLY_REASON",
        payload: readOnlyReason,
      });

      if (!readOnlyReason) return true;
      if (buildStatus === "environmentsBuildInProgress") {
        // In read-only mode, readOnlyReason should be populated via FetchError.
        // because requestStartSession in useAutoStartSession will check if result instanceof FetchError
        return new FetchError(readOnlyReason);
      }

      return triggerRequestBuild(validationData, requestedFromView);
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
