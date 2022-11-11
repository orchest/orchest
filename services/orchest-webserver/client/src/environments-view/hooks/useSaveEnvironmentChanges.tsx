import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAutoSaveEnvironment } from "@/environments-view/edit-environment/hooks/useAutoSaveEnvironment";
import React from "react";
import { environmentDataFromState } from "../common";
import { useEditEnvironment } from "../stores/useEditEnvironment";

/**
 * Watch the changes of environmentChanges and save it to BE in the background. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveEnvironmentChanges = () => {
  const { put } = useEnvironmentsApi();
  const changes = useEditEnvironment((state) => state.changes);

  const save = React.useCallback(() => {
    const environmentData = environmentDataFromState(changes);
    if (environmentData) {
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      put(environmentData.uuid, environmentData);
    }
  }, [changes, put]);

  useAutoSaveEnvironment(changes, save);
};
