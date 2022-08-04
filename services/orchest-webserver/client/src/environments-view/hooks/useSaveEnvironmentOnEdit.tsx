import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useAutoSaveEnvironment } from "@/environment-edit-view/useAutoSaveEnvironment";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getPutEnvironmentPayload } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";
import { useSelectEnvironmentUuid } from "../stores/useSelectEnvironmentUuid";

/**
 * Load the environmentOnEdit to the store based on the query arg environment_uuid.
 * Watch the changes of environmentOnEdit and save it to BE accordingly. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveEnvironmentOnEdit = () => {
  const { environmentUuid } = useSelectEnvironmentUuid();
  const { environments, put } = useEnvironmentsApi();

  const { environmentOnEdit, initEnvironmentOnEdit } = useEnvironmentOnEdit();

  const shouldInit =
    (hasValue(environments) && !environmentOnEdit) ||
    environmentOnEdit?.uuid !== environmentUuid;

  React.useEffect(() => {
    if (!shouldInit) return;
    const initialValue = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];
    if (initialValue) {
      initEnvironmentOnEdit(initialValue);
    }
  }, [shouldInit, environments, environmentUuid, initEnvironmentOnEdit]);

  const save = React.useCallback(() => {
    const environmentData = environmentOnEdit
      ? getPutEnvironmentPayload(environmentOnEdit)
      : undefined;
    if (environmentData) {
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();
      put(environmentData.uuid, environmentData);
    }
  }, [environmentOnEdit, put]);

  useAutoSaveEnvironment(environmentOnEdit, save);

  return { environmentOnEdit };
};
