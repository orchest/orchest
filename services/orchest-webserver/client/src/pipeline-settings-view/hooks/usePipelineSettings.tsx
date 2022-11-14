import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { Service } from "@/types";
import {
  useFetchPipelineSettingsData,
  UseFetchPipelineSettingsParams,
} from "./useFetchPipelineSettingsData";
import { usePipelineEnvVariables } from "./usePipelineEnvVariables";
import { usePipelineProperty } from "./usePipelineProperty";

export const usePipelineSettings = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  snapshotUuid,
  hasRegainedFocus,
}: UseFetchPipelineSettingsParams) => {
  const {
    job,
    pipelineRun,
    pipeline,
    projectEnvVariables,
    hash,
  } = useFetchPipelineSettingsData({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    snapshotUuid,
    hasRegainedFocus,
  });
  const { pipelineJson } = usePipelineDataContext();
  const [pipelineParameters, setPipelineParameters] = usePipelineProperty({
    initialValue: pipelineJson?.parameters
      ? JSON.stringify(pipelineJson.parameters)
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
    pipelineParameters,
    setPipelineParameters,
  };
};
