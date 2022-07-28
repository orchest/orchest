import { CreateEntityButton } from "@/blocks/CreateEntityButton";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import React from "react";
import { getNewEnvironmentName } from "./common";
import { usePostNewEnvironment } from "./hooks/usePostNewEnvironment";
import { useEnvironmentsStore } from "./stores/useEnvironmentsStore";

export const CreateEnvironmentButton = () => {
  const {
    state: { projectUuid },
  } = useProjectsContext();

  const [environments, addEnvironment] = useEnvironmentsStore((state) => [
    state.environments,
    state.add,
  ]);

  const { postEnvironment, isPostingEnvironment } = usePostNewEnvironment();

  const { setAlert, config } = useAppContext();
  const defaultEnvironment = config?.ENVIRONMENT_DEFAULTS;
  const newEnvironmentName = getNewEnvironmentName(
    defaultEnvironment?.name || "New environment",
    environments
  );

  const disabled = !defaultEnvironment || !newEnvironmentName || !projectUuid;

  const createEnvironment = async () => {
    if (isPostingEnvironment || disabled) return;
    try {
      const newEnvironment = await postEnvironment(
        projectUuid,
        newEnvironmentName
      );
      if (newEnvironment) {
        addEnvironment(newEnvironment);
      }
    } catch (error) {
      if (!error.isCanceled) {
        setAlert("Error", `Failed to create new environment. ${String(error)}`);
      }
    }
  };

  return (
    <CreateEntityButton onClick={createEnvironment} disabled={disabled}>
      New environment
    </CreateEntityButton>
  );
};
