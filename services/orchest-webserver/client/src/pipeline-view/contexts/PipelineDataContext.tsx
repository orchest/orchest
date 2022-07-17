import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { StateDispatcher } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { siteMap } from "@/routingConfig";
import { Environment, PipelineJson } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useFetchInteractiveRun } from "../hooks/useFetchInteractiveRun";
import { useIsReadOnly } from "../hooks/useIsReadOnly";

export type PipelineDataContextType = {
  disabled: boolean;
  projectUuid?: string;
  pipelineUuid?: string;
  pipelineCwd?: string;
  environments: Environment[];
  runUuid?: string;
  jobUuid?: string;
  setRunUuid: React.Dispatch<React.SetStateAction<string | undefined>>;
  isReadOnly: boolean;
  pipelineJson?: PipelineJson;
  setPipelineJson: StateDispatcher<PipelineJson>;
  isFetchingPipelineJson: boolean;
};

export const PipelineDataContext = React.createContext<PipelineDataContextType>(
  {} as PipelineDataContextType
);

export const usePipelineDataContext = () =>
  React.useContext(PipelineDataContext);

export const PipelineDataContextProvider: React.FC = ({ children }) => {
  const { setAlert } = useAppContext();

  const {
    pipelineUuid: pipelineUuidFromRoute,
    jobUuid,
    runUuid: runUuidFromRoute,
    navigateTo,
  } = useCustomRoute();

  const {
    state: { pipeline, pipelines, projectUuid },
  } = useProjectsContext();

  // No pipeline found. Editor is frozen and shows "Pipeline not found".
  const disabled = hasValue(pipelines) && pipelines.length === 0;

  const pipelineCwd = pipeline?.path.replace(/\/?[^\/]*.orchest$/, "/");

  // Because `useEnsureValidPipeline` will auto-redirect if pipelineUuidFromRoute is invalid,
  // `pipelineUuid` is only valid until `pipeline?.uuid === pipelineUuidFromRoute`,
  // During the transition, it shouldn't fetch pipelineJson.
  const pipelineUuid =
    pipeline?.uuid === pipelineUuidFromRoute ? pipeline?.uuid : undefined;

  const { runUuid, setRunUuid } = useFetchInteractiveRun(
    projectUuid,
    pipelineUuid,
    runUuidFromRoute
  );

  const isReadOnly = useIsReadOnly(projectUuid, jobUuid, runUuid);

  const {
    pipelineJson,
    setPipelineJson,
    isFetchingPipelineJson,
    error,
  } = useFetchPipelineJson({
    // This `projectUuid` cannot be from route. It has to be from ProjectsContext, aligned with `pipeline?.uuid`.
    // Otherwise, when user switch to another project, pipeline?.uuid does not exist.
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  React.useEffect(() => {
    // This case is hit when a user tries to load a pipeline that belongs
    // to a run that has not started yet. The project files are only
    // copied when the run starts. Before start, the pipeline.json thus
    // cannot be found. Alert the user about missing pipeline and return
    // to JobView.
    if (error)
      setAlert(
        "Error",
        jobUuid
          ? "The .orchest pipeline file could not be found. This pipeline run has not been started. Returning to Job view."
          : "Could not load pipeline",
        (resolve) => {
          resolve(true);
          if (jobUuid) {
            navigateTo(siteMap.job.path, { query: { projectUuid, jobUuid } });
          } else {
            navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
          }

          return true;
        }
      );
  }, [error, setAlert, navigateTo, projectUuid, jobUuid]);

  const { environments = [] } = useFetchEnvironments(
    !isReadOnly ? projectUuid : undefined
  );

  return (
    <PipelineDataContext.Provider
      value={{
        disabled,
        projectUuid,
        pipelineUuid,
        pipelineCwd,
        environments,
        jobUuid,
        runUuid,
        setRunUuid,
        isReadOnly,
        pipelineJson,
        setPipelineJson,
        isFetchingPipelineJson,
      }}
    >
      {children}
    </PipelineDataContext.Provider>
  );
};
