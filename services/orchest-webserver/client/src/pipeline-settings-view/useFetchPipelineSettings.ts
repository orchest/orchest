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

export const useFetchPipelineSettings = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
}: {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
}) => {
  const {
    state: { hasUnsavedChanges },
  } = useAppContext();
  const { dispatch } = useProjectsContext();

  /**
   * hooks for fetching data for initialization
   */

  const { job } = useFetchJob({ jobUuid });
  const { pipelineRun } = useFetchPipelineRun(
    jobUuid && runUuid ? { jobUuid, runUuid } : null
  );

  const { pipelineJson, setPipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  const { pipeline } = useFetchPipeline(
    !jobUuid && pipelineUuid ? { projectUuid, pipelineUuid } : null
  );

  // fetch project env vars only if it's not a job or a pipeline run
  // NOTE: project env var only makes sense for pipelines, because jobs and runs make an copy of all the effective variables
  const { data: projectEnvVariables = [] } = useFetchProject<EnvVarPair[]>({
    projectUuid: !jobUuid && !runUuid && projectUuid ? projectUuid : undefined,
    selector: (project) => envVariablesDictToArray(project.env_variables),
  });

  /**
   * hooks for persisting local mutations without changing the initial data
   */

  // Because the fetch hooks uses SWR and they cache fetched value,
  // pipeline properties might be initialized with cached value.
  // But if the initialization depends on the fetched value, it will easily lead to indefinite re-rendering.
  // Therefore, per update of the fetched value (either new value or cached value), a hash is generated.
  // Inside of `usePipelineProperty` compares the hash and only re-init values accordingly.
  // ? Question: why not clear the cache?
  // Beacuse `SWR` cache is not scoped. If we clear cashe here, it might break all the other components using the same fetch hook.

  const [updateHash, setUpdateHash] = React.useState(uuidv4());

  React.useEffect(() => {
    // Only update if there is no change.
    // Otherwise, user would lose all of their progress when switching browser tabs.
    if (!hasUnsavedChanges) setUpdateHash(uuidv4());
  }, [hasUnsavedChanges, job, pipeline, pipelineJson, pipelineRun]);

  const [inputParameters = "{}", setInputParameters] = usePipelineProperty({
    initialValue: pipelineJson?.parameters
      ? JSON.stringify(pipelineJson.parameters || {})
      : undefined,
    updateHash,
  });

  const [pipelineName, setPipelineName] = usePipelineProperty({
    initialValue: job?.pipeline_name || pipelineJson?.name,
    updateHash,
  });
  const [pipelinePath, setPipelinePath] = usePipelineProperty({
    initialValue:
      job?.pipeline_run_spec.run_config.pipeline_path || pipeline?.path,
    updateHash,
  });

  const [services = {}, setServices] = usePipelineProperty({
    // use temporary uuid for easier FE manipulation, will be cleaned up when saving
    initialValue: pipelineJson?.services
      ? (Object.values(pipelineJson?.services).reduce((all, curr) => {
          return { ...all, [uuidv4()]: curr };
        }, {}) as Record<string, Service>)
      : undefined,
    updateHash,
  });

  const [settings = {}, setSettings] = usePipelineProperty({
    initialValue: pipelineJson?.settings,
    updateHash,
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
    inputParameters,
    setInputParameters,
  };
};
