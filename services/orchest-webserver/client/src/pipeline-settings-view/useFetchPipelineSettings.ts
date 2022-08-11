import { EnvVarPair } from "@/components/EnvVarList";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipeline } from "@/hooks/useFetchPipeline";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchPipelineRun } from "@/hooks/useFetchPipelineRun";
import { useFetchProject } from "@/hooks/useFetchProject";
import { Service } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEnvVariables } from "./usePipelineEnvVariables";
import { usePipelineProperty } from "./usePipelineProperty";

const useFetchProjectEnvVars = ({
  projectUuid,
  jobUuid,
  runUuid,
}: {
  projectUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
}) => {
  const { project, fetchProject } = useFetchProject(
    !jobUuid && !runUuid && projectUuid ? projectUuid : undefined
  );
  const projectEnvVariables = React.useMemo<EnvVarPair[]>(() => {
    if (!project) return [];
    return envVariablesDictToArray(project.env_variables);
  }, [project]);

  return { projectEnvVariables, fetchProjectEnvVars: fetchProject };
};

export const useFetchPipelineSettings = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  isBrowserTabFocused,
}: {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
  isBrowserTabFocused: boolean;
}) => {
  const {
    state: { hasUnsavedChanges },
  } = useAppContext();
  const { dispatch } = useProjectsContext();

  /**
   * hooks for fetching data for initialization
   */

  const { job, fetchJob } = useFetchJob({
    jobUuid,
  });
  const { pipelineRun, fetchPipelineRun } = useFetchPipelineRun({
    jobUuid,
    runUuid,
  });

  const {
    pipelineJson,
    setPipelineJson,
    fetchPipelineJson,
  } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  const { pipeline, fetchPipeline } = useFetchPipeline(
    !jobUuid && pipelineUuid ? { projectUuid, pipelineUuid } : undefined
  );

  // fetch project env vars only if it's not a job or a pipeline run
  // NOTE: project env var only makes sense for pipelines, because jobs and runs make an copy of all the effective variables
  const { projectEnvVariables, fetchProjectEnvVars } = useFetchProjectEnvVars({
    projectUuid,
    jobUuid,
    runUuid,
  });

  /**
   * hooks for persisting local mutations without changing the initial data
   */

  const [hash, updateHash] = React.useReducer(() => uuidv4(), uuidv4());

  const refetch = React.useCallback(() => {
    return Promise.allSettled([
      fetchPipelineJson(),
      fetchPipeline(),
      fetchProjectEnvVars(),
      fetchPipelineRun(),
      fetchJob(),
    ]);
  }, [
    fetchPipelineJson,
    fetchPipeline,
    fetchProjectEnvVars,
    fetchPipelineRun,
    fetchJob,
  ]);

  const reinitialize = React.useCallback(async () => {
    await refetch();
    updateHash();
  }, [refetch, updateHash]);

  React.useEffect(() => {
    // Only reinitialize if there is no change.
    // Otherwise, user would lose all of their progress when switching browser tabs.
    if (isBrowserTabFocused && !hasUnsavedChanges) reinitialize();
  }, [hasUnsavedChanges, isBrowserTabFocused, reinitialize]);

  const [
    pipelineParameters = "{}",
    setPipelineParameters,
  ] = usePipelineProperty({
    initialValue: pipelineJson?.parameters
      ? JSON.stringify(pipelineJson.parameters || {})
      : undefined,
    hash,
  });

  const [pipelineName, setPipelineName] = usePipelineProperty({
    initialValue: job?.pipeline_name || pipelineJson?.name,
    hash,
  });
  const [pipelinePath, setPipelinePath] = usePipelineProperty({
    initialValue:
      job?.pipeline_run_spec.run_config.pipeline_path || pipeline?.path,
    hash,
  });

  const [services = {}, setServices] = usePipelineProperty({
    // use temporary uuid for easier FE manipulation, will be cleaned up when saving
    initialValue: pipelineJson?.services
      ? (Object.values(pipelineJson?.services).reduce((all, curr) => {
          return { ...all, [curr.order]: curr };
        }, {}) as Record<string, Service>)
      : undefined,
    hash,
  });

  const [settings = {}, setSettings] = usePipelineProperty({
    initialValue: pipelineJson?.settings,
    hash,
  });

  const { envVariables, setEnvVariables } = usePipelineEnvVariables(
    pipeline,
    pipelineRun
  );

  /**
   * Update ProjectsContext
   */
  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!initialized.current && pipelineUuid && pipelineJson && pipelinePath) {
      initialized.current = true;
      dispatch({ type: "UPDATE_PIPELINE", payload: { uuid: pipelineUuid } });
    }
  }, [
    pipelineJson,
    pipelineUuid,
    pipelinePath,
    projectUuid,
    initialized,
    dispatch,
  ]);

  return {
    envVariables,
    setEnvVariables,
    projectEnvVariables,
    pipelineName,
    setPipelineName,
    pipelinePath,
    setPipelinePath,
    services,
    setServices,
    settings,
    setSettings,
    pipelineJson,
    setPipelineJson,
    pipelineParameters,
    setPipelineParameters,
  };
};
