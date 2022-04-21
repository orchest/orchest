import { EnvVarPair } from "@/components/EnvVarList";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipeline } from "@/hooks/useFetchPipeline";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchPipelineRun } from "@/hooks/useFetchPipelineRun";
import { useFetchProject } from "@/hooks/useFetchProject";
import { Service } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
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
  const { state, dispatch } = useProjectsContext();

  const isPipelineLoaded = hasValue(state.pipeline);

  /**
   * hooks for fetching data for initialization
   */

  const { job, isFetchingJob } = useFetchJob(jobUuid);
  const { pipelineRun } = useFetchPipelineRun(
    jobUuid && runUuid ? { jobUuid, runUuid } : null
  );

  const {
    pipelineJson,
    setPipelineJson,
    isFetchingPipelineJson,
  } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  const { pipeline, isFetchingPipeline } = useFetchPipeline(
    !jobUuid && pipelineUuid ? { projectUuid, pipelineUuid } : null
  );

  const { initialPipelineName, initialPipelinePath } = React.useMemo<{
    initialPipelineName?: string | undefined;
    initialPipelinePath?: string | undefined;
  }>(() => {
    if (
      !isPipelineLoaded ||
      isFetchingJob ||
      isFetchingPipelineJson ||
      isFetchingPipeline
    )
      return {};

    return {
      initialPipelineName: job?.pipeline_name || pipelineJson?.name,
      initialPipelinePath:
        job?.pipeline_run_spec.run_config.pipeline_path || pipeline?.path,
    };
  }, [
    isPipelineLoaded,
    isFetchingJob,
    isFetchingPipeline,
    isFetchingPipelineJson,
    job?.pipeline_name,
    pipelineJson?.name,
    job?.pipeline_run_spec.run_config.pipeline_path,
    pipeline?.path,
  ]);

  /**
   * hooks for persisting local mutations without changing the initial data
   */

  const [inputParameters, setInputParameters] = usePipelineProperty(
    pipelineJson?.parameters
      ? JSON.stringify(pipelineJson.parameters || {})
      : undefined,
    "{}"
  );

  const [pipelineName, setPipelineName] = usePipelineProperty(
    initialPipelineName
  );
  const [pipelinePath, setPipelinePath] = usePipelineProperty(
    initialPipelinePath
  );

  const [services, setServices] = usePipelineProperty(
    // use temporary uuid for easier FE manipulation, will be cleaned up when saving
    pipelineJson?.services
      ? (Object.values(pipelineJson?.services).reduce((all, curr) => {
          return { ...all, [uuidv4()]: curr };
        }, {}) as Record<string, Service>)
      : undefined,
    {}
  );

  const [settings, setSettings] = usePipelineProperty(
    pipelineJson?.settings,
    {}
  );

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
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    }
  }, [
    pipelineJson,
    pipelineUuid,
    pipelinePath,
    projectUuid,
    initialized,
    dispatch,
  ]);

  // fetch project env vars only if it's not a job or a pipeline run
  // NOTE: project env var only makes sense for pipelines, because jobs and runs make an copy of all the effective variables
  const { data: projectEnvVariables } = useFetchProject<EnvVarPair[]>({
    projectUuid: !jobUuid && !runUuid && projectUuid ? projectUuid : undefined,
    selector: (project) => envVariablesDictToArray(project.env_variables),
  });

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
