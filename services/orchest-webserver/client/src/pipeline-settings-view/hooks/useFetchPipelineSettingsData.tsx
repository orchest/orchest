import { EnvVarPair } from "@/components/EnvVarList";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useFetchJob } from "@/hooks/useFetchJob";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useFetchPipelineRun } from "@/hooks/useFetchPipelineRun";
import { useFetchPipelineState } from "@/hooks/useFetchPipelineState";
import { useFetchProject } from "@/hooks/useFetchProject";
import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";

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

export type UseFetchPipelineSettingsParams = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
  snapshotUuid: string | undefined;
  hasRegainedFocus: boolean;
};

export const useFetchPipelineSettingsData = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  snapshotUuid,
}: UseFetchPipelineSettingsParams) => {
  const { job, reload: fetchJob } = useFetchJob(jobUuid);
  const { pipelineRun, fetchPipelineRun } = useFetchPipelineRun({
    jobUuid,
    runUuid,
  });

  const { setPipelineJson } = usePipelineDataContext();
  const { fetchPipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    snapshotUuid,
  });

  const { pipeline, reload: fetchPipeline } = useFetchPipelineState(
    projectUuid,
    pipelineUuid
  );

  // fetch project env vars only if it's not a job or a pipeline run
  // NOTE: project env var only makes sense for pipelines, because jobs and runs make an copy of all the effective variables
  const { projectEnvVariables, fetchProjectEnvVars } = useFetchProjectEnvVars({
    projectUuid,
    jobUuid,
    runUuid,
  });

  const refetch = React.useCallback(() => {
    return Promise.allSettled([
      fetchPipelineJson().then((data) => data && setPipelineJson(data)),
      fetchPipeline(),
      fetchProjectEnvVars(),
      fetchPipelineRun(),
      fetchJob(),
    ]);
  }, [
    fetchPipelineJson,
    setPipelineJson,
    fetchPipeline,
    fetchProjectEnvVars,
    fetchPipelineRun,
    fetchJob,
  ]);

  const [hash, reinitializeStates] = React.useReducer(() => uuidv4(), uuidv4());

  const reinitialize = React.useCallback(async () => {
    await refetch();
    reinitializeStates();
  }, [refetch, reinitializeStates]);

  const {
    state: { hasUnsavedChanges },
  } = useGlobalContext();

  const hasRegainedFocus = useRegainBrowserTabFocus();

  React.useEffect(() => {
    // Only reinitialize if there is no change.
    // Otherwise, user would lose all of their progress when switching browser tabs.
    if (hasRegainedFocus && !hasUnsavedChanges) reinitialize();
  }, [hasUnsavedChanges, hasRegainedFocus, reinitialize]);

  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!initialized.current && pipelineUuid && (pipeline || job)) {
      initialized.current = true;
    }
  }, [job, pipeline, pipelineUuid, initialized]);

  return {
    job,
    pipelineRun,
    pipeline,
    projectEnvVariables,
    hash,
  };
};
