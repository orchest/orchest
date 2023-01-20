import { EnvVarPair } from "@/components/EnvVarList";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { PipelineRun, PipelineState } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import React from "react";

export const usePipelineEnvVariables = (
  pipeline: PipelineState | undefined,
  pipelineRun: PipelineRun | undefined
) => {
  const { setAsSaved } = useGlobalContext();

  // Environment variables are fetched either from 1) pipeline 2) pipeline run
  const [envVariables, _setEnvVariables] = React.useState<
    EnvVarPair[] | undefined
  >([]);

  const fetchedEnvVariables = React.useMemo(() => {
    if (pipeline || pipelineRun) {
      return pipeline
        ? pipeline.env_variables
        : pipelineRun
        ? pipelineRun.env_variables
        : {};
    }
    return null;
  }, [pipeline, pipelineRun]);

  React.useEffect(() => {
    if (fetchedEnvVariables) {
      const envVarArray = envVariablesDictToArray(fetchedEnvVariables);
      _setEnvVariables(envVarArray);
    }
  }, [fetchedEnvVariables]);

  const setEnvVariables = React.useCallback(
    (data: React.SetStateAction<EnvVarPair[] | undefined>) => {
      _setEnvVariables(data);
      setAsSaved(false);
    },
    [_setEnvVariables, setAsSaved]
  );

  return { envVariables, setEnvVariables };
};
