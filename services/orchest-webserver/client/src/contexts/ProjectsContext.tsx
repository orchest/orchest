import type {
  EnvironmentValidationData,
  PipelineMetaData,
  Project,
  ReducerActionWithCallback,
} from "@/types";
import { checkGate } from "@/utils/webserver-utils";
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

export type IProjectsContextState = {
  projectUuid?: string;
  pipelineIsReadOnly: boolean;
  pipelineSaveStatus: "saved" | "saving";
  pipelines: PipelineMetaData[] | undefined;
  pipeline?: PipelineMetaData | undefined;
  projects: Project[];
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
    }
  | {
      type: "SET_BUILD_REQUEST";
      payload: BuildRequest | undefined;
    };

export type ProjectsContextAction = ReducerActionWithCallback<
  IProjectsContextState,
  Action
>;

export interface IProjectsContext {
  state: IProjectsContextState;
  dispatch: (value: ProjectsContextAction) => void;
  ensureEnvironmentsAreBuilt: (
    requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
  ) => Promise<boolean>;
  requestBuild: RequestBuildDispatcher;
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
      return {
        ...state,
        pipelines: action.payload,
        pipeline: undefined,
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

      const isPipelineRemoved = !action.payload.some(
        (pipeline) => state.pipeline?.path === pipeline.path
      );

      return {
        ...state,
        pipelines: action.payload,
        pipeline: isPipelineRemoved ? action.payload[0] : state.pipeline,
        hasLoadedPipelinesInPipelineEditor: true,
      };
    }
    case "SET_PIPELINE_SAVE_STATUS":
      return { ...state, pipelineSaveStatus: action.payload };
    case "SET_PIPELINE_IS_READONLY":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "SET_PROJECT": {
      if (!action.payload) {
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
      const foundProject = state.projects.find(
        (project) => project.uuid === action.payload
      );
      if (!foundProject) return state;
      return {
        ...state,
        projectUuid: foundProject.uuid,
        pipelines: undefined,
        pipeline: undefined,
        hasLoadedPipelinesInPipelineEditor: false,
      };
    }
    case "SET_PROJECTS":
      return { ...state, projects: action.payload, hasLoadedProjects: true };
    case "SET_BUILD_REQUEST": {
      return { ...state, buildRequest: action.payload };
    }
    default: {
      console.log(action);
      return state;
    }
  }
};

const initialState: IProjectsContextState = {
  pipelineIsReadOnly: true,
  pipelineSaveStatus: "saved",
  pipelines: undefined,
  projects: [],
  hasLoadedProjects: false,
  hasLoadedPipelinesInPipelineEditor: false,
  newPipelineUuid: undefined,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const requestBuild = React.useCallback(
    (
      projectUuid: string,
      environmentValidationData: EnvironmentValidationData,
      requestedFromView?: BUILD_IMAGE_SOLUTION_VIEW
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

  const doRequestBuild = React.useCallback(
    async (
      environmentValidationData: EnvironmentValidationData,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      if (!state.projectUuid) return false;
      const shouldSetReadOnly =
        requestedFromView &&
        [
          BUILD_IMAGE_SOLUTION_VIEW.PIPELINE,
          BUILD_IMAGE_SOLUTION_VIEW.JUPYTER_LAB,
        ].includes(requestedFromView);

      if (shouldSetReadOnly)
        dispatch({
          type: "SET_PIPELINE_IS_READONLY",
          payload: true,
        });

      const hasBuilt = await requestBuild(
        state.projectUuid,
        environmentValidationData,
        requestedFromView
      );

      if (shouldSetReadOnly && hasBuilt) {
        dispatch({
          type: "SET_PIPELINE_IS_READONLY",
          payload: false,
        });
      }
      return hasBuilt;
    },
    [requestBuild, state.projectUuid]
  );

  const ensureEnvironmentsAreBuilt = React.useCallback(
    async (requestedFromView: BUILD_IMAGE_SOLUTION_VIEW): Promise<boolean> => {
      if (!state.projectUuid) return false;
      try {
        await checkGate(state.projectUuid);
        return true;
      } catch (error) {
        return doRequestBuild(error.data, requestedFromView);
      }
    },
    [state.projectUuid, doRequestBuild]
  );

  return (
    <ProjectsContext.Provider
      value={{ state, dispatch, ensureEnvironmentsAreBuilt, requestBuild }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};
