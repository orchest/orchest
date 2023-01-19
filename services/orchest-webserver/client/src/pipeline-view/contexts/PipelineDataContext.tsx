import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useActivePipeline } from "@/hooks/useActivePipeline";
import { useActiveProject } from "@/hooks/useActiveProject";
import { StateDispatcher } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEnsureValidPipeline } from "@/hooks/useEnsureValidPipeline";
import { useFetchActivePipelineRun } from "@/hooks/useFetchActivePipelineRun";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useProjectPipelines } from "@/hooks/useProjectPipelines";
import { siteMap } from "@/routingConfig";
import { JobData, PipelineJsonState, PipelineMetaData } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useIsReadOnly } from "../hooks/useIsReadOnly";

export type PipelineDataContextType = {
  disabled: boolean;
  projectUuid?: string;
  pipelineUuid?: string;
  pipelineCwd?: string;
  runUuid?: string;
  jobUuid?: string;
  isReadOnly: boolean;
  pipelineJson?: PipelineJsonState;
  setPipelineJson: StateDispatcher<PipelineJsonState>;
  isFetchingPipelineJson: boolean;
  /** If true, this pipeline is from a job run. */
  isJobRun: boolean;
  /** If true, this pipeline is a snapshot for a job. */
  isSnapshot: boolean;
  /** If true, this pipeline is interactive: it is not a job snapshot or from a job run. */
  isInteractive: boolean;
  pipeline?: PipelineMetaData;
  job?: JobData;
};

export const PipelineDataContext = React.createContext<PipelineDataContextType>(
  {} as PipelineDataContextType
);

export const usePipelineDataContext = () =>
  React.useContext(PipelineDataContext);

export const PipelineDataContextProvider: React.FC = ({ children }) => {
  const { setAlert } = useGlobalContext();
  const activeProject = useActiveProject();
  useEnsureValidPipeline();

  const {
    pipelineUuid: pipelineUuidFromRoute,
    jobUuid,
    runUuid: runUuidFromRoute,
    snapshotUuid,
    navigateTo,
  } = useCustomRoute();

  const { pipelineReadOnlyReason } = useProjectsContext().state;

  const pipelines = useProjectPipelines(activeProject?.uuid);
  const pipeline = useActivePipeline();

  // No pipeline found. Editor is frozen and shows "Pipeline not found".
  const disabled = hasValue(pipelines) && pipelines.length === 0;

  const pipelineCwd = pipeline?.path.replace(/\/?[^\/]*.orchest$/, "/");

  // Because `useEnsureValidPipeline` will auto-redirect if pipelineUuidFromRoute is invalid,
  // `pipelineUuid` is only valid until `pipeline?.uuid === pipelineUuidFromRoute`,
  // During the transition, it shouldn't fetch pipelineJson.
  const pipelineUuid =
    pipeline?.uuid === pipelineUuidFromRoute ? pipeline?.uuid : undefined;

  const activePipelineRun = useFetchActivePipelineRun();

  useIsReadOnly();

  const isReadOnly = Boolean(pipelineReadOnlyReason);

  const {
    pipelineJson,
    setPipelineJson,
    isFetchingPipelineJson,
    error,
  } = useFetchPipelineJson({
    // This `projectUuid` cannot be from route. It has to be from ProjectsContext, aligned with `pipeline?.uuid`.
    // Otherwise, when user switch to another project, pipeline?.uuid does not exist.
    projectUuid: activeProject?.uuid,
    pipelineUuid,
    jobUuid,
    runUuid: activePipelineRun?.uuid,
    snapshotUuid,
  });

  React.useEffect(() => {
    if (!activeProject) return;

    // This case is hit when a user tries to load a pipeline that belongs
    // to a run that has not started yet. The project files are only
    // copied when the run starts. Before start, the pipeline.json thus
    // cannot be found. Alert the user about missing pipeline and return
    // to JobView.
    if (error)
      setAlert(
        "Error",
        jobUuid
          ? "The .orchest pipeline file could not be found. This pipeline run has not been started. Returning to Jobs view."
          : "Could not load pipeline",
        (resolve) => {
          resolve(true);
          if (jobUuid) {
            navigateTo(siteMap.jobs.path, {
              query: { projectUuid: activeProject.uuid, jobUuid },
            });
          } else {
            navigateTo(siteMap.pipeline.path, {
              query: { projectUuid: activeProject.uuid },
            });
          }

          return true;
        }
      );
  }, [error, setAlert, navigateTo, jobUuid, activeProject]);

  const isJobRun = hasValue(jobUuid) && hasValue(runUuidFromRoute);
  const isSnapshot = hasValue(jobUuid) && hasValue(snapshotUuid);
  const isInteractive = !isJobRun && !isSnapshot;
  const { job } = useFetchJob(isJobRun || isSnapshot ? jobUuid : undefined);

  return (
    <PipelineDataContext.Provider
      value={{
        disabled,
        projectUuid: activeProject?.uuid,
        pipelineUuid,
        pipeline,
        pipelineCwd,
        jobUuid,
        runUuid: activePipelineRun?.uuid,
        isReadOnly,
        isInteractive,
        pipelineJson,
        setPipelineJson,
        isFetchingPipelineJson,
        isJobRun,
        isSnapshot,
        job,
      }}
    >
      {children}
    </PipelineDataContext.Provider>
  );
};
