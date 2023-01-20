import { useJupyterLabSetupScriptApi } from "@/api/jupyter-lab-setup-script/useJupyterLabSetupScriptApi";
import React from "react";
import { useAsync } from "./useAsync";

/** Fetches JupyterLab setup script on mount. */
export function useFetchJupyterLabSetupScriptOnMount() {
  const { run } = useAsync<string>();
  const fetchSetupScript = useJupyterLabSetupScriptApi((state) => state.fetch);

  React.useEffect(() => {
    run(fetchSetupScript());
  }, [run, fetchSetupScript]);
}
