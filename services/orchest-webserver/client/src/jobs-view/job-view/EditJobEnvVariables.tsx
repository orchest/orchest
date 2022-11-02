import { EnvVarList, EnvVarPair } from "@/components/EnvVarList";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
} from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useValidJobQueryArgs } from "../hooks/useValidJobQueryArgs";
import { useEditJob } from "../stores/useEditJob";

const useEnvVariables = () => {
  const [envVariables, setEnvVariables] = React.useState<
    EnvVarPair[] | undefined
  >();

  const { jobUuid } = useValidJobQueryArgs();
  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);

  React.useEffect(() => {
    if (jobUuid && pipelineUuid) setEnvVariables(undefined);
  }, [jobUuid, pipelineUuid]);

  const value = useEditJob((state) => state.jobChanges?.env_variables);

  const shouldInitiate = !hasValue(envVariables) && hasValue(value);
  React.useEffect(() => {
    if (shouldInitiate) setEnvVariables(envVariablesDictToArray(value));
  }, [value, shouldInitiate]);

  return [envVariables, setEnvVariables] as const;
};

const useSaveEnvVariables = (envVariables: EnvVarPair[] | undefined) => {
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const setValue = React.useCallback(
    (newValue: EnvVarPair[]) => {
      const results = envVariablesArrayToDict(newValue);
      if (results.status === "resolved") {
        setJobChanges({ env_variables: results.value });
      }
    },
    [setJobChanges]
  );

  React.useEffect(() => {
    if (hasValue(envVariables)) {
      setValue(envVariables);
    }
  }, [envVariables, setValue]);
};

export const EditJobEnvVariables = () => {
  const isReadOnly = useEditJob((state) => !state.isEditing);

  const [envVariables, setEnvVariables] = useEnvVariables();
  useSaveEnvVariables(envVariables);

  return (
    <EnvVarList
      variables={envVariables || []}
      setValue={setEnvVariables}
      readOnly={isReadOnly}
    />
  );
};
