import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAutoSaveEnvironment } from "@/environments-view/edit-environment/hooks/useAutoSaveEnvironment";
import React from "react";
import { extractEnvironmentFromState } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

/**
 * Watch the changes of environmentOnEdit and save it to BE in the background. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveEnvironmentOnEdit = () => {
  const { put } = useEnvironmentsApi();
  const { environmentOnEdit } = useEnvironmentOnEdit();

  const save = React.useCallback(() => {
    const environmentData = extractEnvironmentFromState(environmentOnEdit);
    if (environmentData) {
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      put(environmentData.uuid, environmentData);
    }
  }, [environmentOnEdit, put]);

  useAutoSaveEnvironment(environmentOnEdit, save);
};
