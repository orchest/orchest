import { EnvVarPair } from "@/components/EnvVarList";
import { useAppContext } from "@/contexts/AppContext";
import { useFetchPipeline } from "@/hooks/useFetchPipeline";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchPipelineRun } from "@/hooks/useFetchPipelineRun";
import { useFetchProject } from "@/hooks/useFetchProject";
import { useFetchJob } from "@/job-view/useFetchJob";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import React from "react";

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
  const { setAsSaved } = useAppContext();

  const { job } = useFetchJob(jobUuid, false);
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

  const pipelinePath =
    job?.pipeline_run_spec.run_config.pipeline_path || pipeline?.path;

  const pipelineName = job?.pipeline_name || pipelineJson?.name;

  // Environment variables are fetched either from 1) pipeline 2) pipeline run
  const [envVariables, _setEnvVariables] = React.useState<EnvVarPair[]>([]);
  React.useEffect(() => {
    if (pipeline || pipelineRun) {
      const envVarArray = envVariablesDictToArray(
        pipeline
          ? pipeline.env_variables
          : pipelineRun
          ? pipelineRun.env_variables
          : {}
      );
      _setEnvVariables(envVarArray);
    }
  }, [pipeline, pipelineRun]);

  const setEnvVariables = React.useCallback(
    (data: React.SetStateAction<EnvVarPair[]>) => {
      _setEnvVariables(data);
      setAsSaved(false);
    },
    [_setEnvVariables, setAsSaved]
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
    pipelinePath,
    pipelineJson,
    setPipelineJson,
  };
};
