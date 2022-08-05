import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAutoSaveEnvironment } from "@/environments-view/edit-environment/hooks/useAutoSaveEnvironment";
import React from "react";
import { getPutEnvironmentPayload } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

/**
 * Watch the changes of environmentOnEdit and save it to BE in the background. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveEnvironmentOnEdit = () => {
  const { put, setEnvironment } = useEnvironmentsApi();
  const { environmentOnEdit } = useEnvironmentOnEdit();

  const save = React.useCallback(async () => {
    const environmentData = environmentOnEdit
      ? getPutEnvironmentPayload(environmentOnEdit)
      : undefined;
    if (environmentData) {
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      const updatedEnvironment = await put(
        environmentData.uuid,
        environmentData
      );
      if (updatedEnvironment) {
        setEnvironment(environmentData.uuid, updatedEnvironment);
      }
    }
  }, [environmentOnEdit, setEnvironment, put]);

  useAutoSaveEnvironment(environmentOnEdit, save);

  return { environmentOnEdit };
};
