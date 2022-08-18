import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { extractEnvironmentFromState } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Update useEnvironmentApi with environmentChanges on unmount.
 * To keep useEnvironmentApi updated when user leaves the environment editing view.
 */
export const useUpdateEnvironmentOnUnmount = () => {
  const setEnvironment = useEnvironmentsApi((state) => state.setEnvironment);

  const environmentChangesRef = React.useRef(
    useEditEnvironment.getState().environmentChanges
  );

  React.useEffect(
    () =>
      useEditEnvironment.subscribe(
        (state) => (environmentChangesRef.current = state.environmentChanges)
      ),
    []
  );

  const updateEnvironment = React.useCallback(() => {
    const environment =
      environmentChangesRef.current &&
      extractEnvironmentFromState(environmentChangesRef.current);
    if (environment) {
      setEnvironment(environment.uuid, environment);
    }
  }, [setEnvironment]);

  React.useEffect(() => {
    return () => updateEnvironment();
  }, [updateEnvironment]);
};
