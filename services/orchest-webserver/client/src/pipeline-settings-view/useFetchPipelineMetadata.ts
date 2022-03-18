import { EnvVarPair } from "@/components/EnvVarList";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipeline } from "@/hooks/useFetchPipeline";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchPipelineRun } from "@/hooks/useFetchPipelineRun";
import { useFetchProject } from "@/hooks/useFetchProject";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEnvVariables } from "./usePipelineEnvVariables";
import { usePipelineProperty } from "./usePipelineProperty";

export const useFetchPipelineMetadata = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
}: {
  projectUuid: string;
  pipelineUuid: string;
  jobUuid?: string;
  runUuid?: string;
}) => {
  const { dispatch } = useProjectsContext();

  /**
   * hooks for fetching data for initialization
   */

  const { job } = useFetchJob(jobUuid);
  const { pipeline } = useFetchPipeline(
    !jobUuid ? { projectUuid, pipelineUuid } : null
  );
  const { pipelineRun } = useFetchPipelineRun(
    jobUuid && runUuid ? { jobUuid, runUuid } : null
  );

  const { pipelineJson, setPipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
  });

  /**
   * Update ProjectsContext
   */
  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!initialized.current && pipelineJson) {
      initialized.current = true;
      dispatch({
        type: "pipelineSet",
        payload: {
          pipelineUuid,
          projectUuid,
          pipelineName: pipelineJson.name,
        },
      });
    }
  }, [pipelineJson, pipelineUuid, projectUuid, initialized, dispatch]);

  /**
   * hooks for persisting local mutations without changing the initial data
   */

  const [inputParameters, setInputParameters] = usePipelineProperty(
    pipelineJson?.parameters
      ? JSON.stringify(pipelineJson.parameters || {})
      : null,
    "{}"
  );
  const [pipelineName, setPipelineName] = usePipelineProperty(
    job?.pipeline_name || pipelineJson?.name
  );

  const [pipelinePath, setPipelinePath] = usePipelineProperty(
    job?.pipeline_run_spec.run_config.pipeline_path || pipeline?.path
  );

  const [services, setServices] = usePipelineProperty(
    // use temporary uuid for easier FE manipulation, will be cleaned up when saving
    Object.values(pipelineJson?.services || {}).reduce((all, curr) => {
      return { ...all, [uuidv4()]: curr };
    }, {})
  );

  const [settings, setSettings] = usePipelineProperty(
    pipelineJson?.settings,
    {}
  );

  const { envVariables, setEnvVariables } = usePipelineEnvVariables(
    pipeline,
    pipelineRun
  );

  // fetch project env vars only if it's not a job or a pipeline run
  // NOTE: project env var only makes sense for pipelines, because jobs and runs make an copy of all the effective variables
  const { data: projectEnvVariables } = useFetchProject<EnvVarPair[]>({
    projectUuid: !jobUuid && !runUuid && projectUuid ? projectUuid : null,
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
