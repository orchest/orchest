import { useJupyterLabSetupScriptApi } from "@/api/jupyter-lab-setup-script/useJupyterLabSetupScriptApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchJupyterLabSetupScriptOnMount } from "@/hooks/useFetchJupyterLabSetupScriptOnMount";
import { useTextField } from "@/hooks/useTextField";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useInitJupyterLabSetupScript } from "./useInitJupyterLabSetupScript";

/**
 * Maintains the states of the text filed of JupyterLab setup script.
 * Also fetches the data from BE on mount, and update BE when value changes.
 */
export const useJupyterLabSetupScript = () => {
  useFetchJupyterLabSetupScriptOnMount();

  const { setAsSaved } = useGlobalContext();
  const update = useJupyterLabSetupScriptApi((state) => state.update);
  const isLoading = useJupyterLabSetupScriptApi(
    (state) => !hasValue(state.setupScript)
  );

  const textField = useTextField();
  const { value, setValue } = textField;
  useInitJupyterLabSetupScript(setValue);

  const { run } = useAsync();
  const payload = useDebounce(value, 250);
  const save = React.useCallback(async () => {
    if (!hasValue(payload)) return;

    setAsSaved(false);

    try {
      await run(update(payload));
      setAsSaved();
    } catch (e) {
      console.error(e);
    }
  }, [payload, update, run, setAsSaved]);
  React.useEffect(() => {
    save();
  }, [save]);

  return { ...textField, isLoading };
};
