import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useCancelablePromise } from "@/hooks/useCancelablePromise";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  EnvironmentValidationData,
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

const ProjectsContext = React.createContext<ProjectContext>(
  {} as ProjectContext
);

export type PipelineReadOnlyReason =
  | "isSnapshot"
  | "isJobRun"
  | "environmentsNotYetBuilt"
  | "environmentsBuildInProgress"
  | "environmentsFailedToBuild"
  | "JupyterEnvironmentBuildInProgress";

export type ProjectContextState = {
  pipelineReadOnlyReason?: PipelineReadOnlyReason;
  pipelineSaveStatus: "saved" | "saving";
  newPipelineUuid: string | undefined;
  buildRequest?: BuildRequest;
};

export const useProjectsContext = () => React.useContext(ProjectsContext);

type Action =
  | {
      type: "SET_PIPELINE_SAVE_STATUS";
      payload: ProjectContextState["pipelineSaveStatus"];
    }
  | {
      type: "SET_PIPELINE_READONLY_REASON";
      payload: PipelineReadOnlyReason | undefined;
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

export interface ProjectContext {
  state: ProjectContextState;
  dispatch: (value: ProjectsContextAction) => void;
  ensureEnvironmentsAreBuilt: (
    requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
  ) => Promise<true | Error>;
  requestBuild: RequestBuildDispatcher;
}

const baseState: ProjectContextState = {
  pipelineSaveStatus: "saved",
  newPipelineUuid: undefined,
};

export const ProjectsContextProvider: React.FC = ({ children }) => {
  const { projects, hasData } = useFetchProjects();
  const activeProject = useActiveProject();

  const [pipelinesByProject, setPipelinesByProject] = useLocalStorage<
    Record<string, string>
  >("pipelineEditor.lastSeenPipelines", {});

  const setActivePipeline = React.useCallback(
    (projectUuid: string | undefined, pipelineUuid: string | null) => {
      if (!projectUuid) return;

      setPipelinesByProject((active) => {
        if (!pipelineUuid) {
          delete active[projectUuid];
          return active;
        }
        if (active[projectUuid] === pipelineUuid) return active;
        return { ...active, [projectUuid]: pipelineUuid };
      });
    },
    [setPipelinesByProject]
  );

  React.useEffect(() => {
    if (!hasData) return;

    // Prune "active pipelines" from projects that no longer exist:

    setPipelinesByProject((current) => {
      if (!current) return {};

      return Object.fromEntries(
        Object.entries(current).filter(
          ([projectUuid]) => projects?.[projectUuid]
        )
      );
    });
  }, [projects, hasData, setPipelinesByProject]);

  const stringifiedLastSeenPipelines = React.useMemo(
    () => JSON.stringify(pipelinesByProject),
    [pipelinesByProject]
  );

  const memoizedReducer = React.useCallback(
    (state: ProjectContextState, _action: ProjectsContextAction) => {
      const action = _action instanceof Function ? _action(state) : _action;

      switch (action.type) {
        case "SET_PIPELINE_SAVE_STATUS":
          return { ...state, pipelineSaveStatus: action.payload };
        case "SET_PIPELINE_READONLY_REASON":
          return { ...state, pipelineReadOnlyReason: action.payload };
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
  const [state, dispatch] = React.useReducer(memoizedReducer, {
    ...baseState,
  });

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
      projectUuid: string | undefined,
      environmentValidationData: EnvironmentValidationData | undefined,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      if (!projectUuid) return new Error("project UUID unavailable");
      if (!environmentValidationData) return new Error("Unable to validate");

      return requestBuild(
        projectUuid,
        environmentValidationData,
        requestedFromView
      );
    },
    [requestBuild]
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

      return triggerRequestBuild(
        activeProject?.uuid,
        validationData,
        requestedFromView
      );
    },
    [validate, activeProject?.uuid, triggerRequestBuild]
  );

  return (
    <ProjectsContext.Provider
      value={{ state, dispatch, ensureEnvironmentsAreBuilt, requestBuild }}
    >
      {children}
    </ProjectsContext.Provider>
  );
};
