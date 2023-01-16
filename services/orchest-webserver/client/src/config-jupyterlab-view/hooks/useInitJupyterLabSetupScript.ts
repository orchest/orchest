import { useJupyterLabSetupScriptApi } from "@/api/jupyter-lab-setup-script/useJupyterLabSetupScriptApi";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/** When JupyterLab setup script gets loaded, initialize the value with the given setValue function. */
export const useInitJupyterLabSetupScript = (
  initValue: (value: string) => void
) => {
  const value = useJupyterLabSetupScriptApi(
    (state) => state.setupScript,
    // if value has been loaded, `equal` function always return true. It will then never trigger re-render.
    (prev) => hasValue(prev)
  );

  React.useEffect(() => {
    if (value) initValue(value);
  }, [value, initValue]);
};
