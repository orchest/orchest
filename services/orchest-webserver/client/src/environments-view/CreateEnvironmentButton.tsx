import {
  CreateEntityButton,
  CreateEntityButtonProps,
} from "@/blocks/CreateEntityButton";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import React from "react";
import { getNewEnvironmentName } from "./common";
import {
  EnvironmentsState,
  useEnvironmentsStore,
} from "./stores/useEnvironmentsStore";

const selector = (state: EnvironmentsState) =>
  [
    state.environments,
    state.post,
    state.isPosting,
    state.error,
    state.clearError,
  ] as const;

type CreateEnvironmentButtonProps = Omit<
  CreateEntityButtonProps,
  "children" | "onClick" | "disabled"
>;

export const CreateEnvironmentButton = (
  props: CreateEnvironmentButtonProps
) => {
  const {
    state: { projectUuid },
  } = useProjectsContext();

  const [
    environments,
    postEnvironment,
    isPostingEnvironment,
    error,
    clearError,
  ] = useEnvironmentsStore(selector);

  const { setAlert, config } = useAppContext();
  const defaultEnvironment = config?.ENVIRONMENT_DEFAULTS;
  const newEnvironmentName = getNewEnvironmentName(
    defaultEnvironment?.name || "New environment",
    environments
  );

  const disabled = !defaultEnvironment || !newEnvironmentName || !projectUuid;

  const createEnvironment = async () => {
    if (isPostingEnvironment || disabled) return;
    postEnvironment(newEnvironmentName, defaultEnvironment);
  };

  React.useEffect(() => {
    if (error) {
      setAlert(
        "Error",
        `Unable to create environment. ${String(error)}`,
        (resolve) => {
          clearError();
          resolve(true);
          return true;
        }
      );
    }
  }, [setAlert, error, clearError]);

  return (
    <CreateEntityButton
      onClick={createEnvironment}
      disabled={disabled}
      {...props}
    >
      New environment
    </CreateEntityButton>
  );
};
