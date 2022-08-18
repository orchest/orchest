import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import React from "react";
import { extractEnvironmentFromState } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

/**
 * Update useEnvironmentApi with environmentOnEdit on unmount.
 * To keep useEnvironmentApi updated when user leaves the environment editing view.
 */
export const useUpdateEnvironmentOnUnmount = () => {
  const setEnvironment = useEnvironmentsApi((state) => state.setEnvironment);

  const environmentOnEditRef = React.useRef(
    useEnvironmentOnEdit.getState().environmentOnEdit
  );

  React.useEffect(
    () =>
      useEnvironmentOnEdit.subscribe(
        (state) => (environmentOnEditRef.current = state.environmentOnEdit)
      ),
    []
  );

  const updateEnvironment = React.useCallback(() => {
    const environment =
      environmentOnEditRef.current &&
      extractEnvironmentFromState(environmentOnEditRef.current);
    if (environment) {
      setEnvironment(environment.uuid, environment);
    }
  }, [setEnvironment]);

  React.useEffect(() => {
    return () => updateEnvironment();
  }, [updateEnvironment]);
};
