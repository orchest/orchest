import { fetcher } from "@orchest/lib-utils";

export const JUPYTER_LAB_SETUP_SCRIPT_API_URL = "/async/jupyter-setup-script";

/** Fetches the setup script of JupyterLab */
export const fetchOne = () =>
  fetcher<{ script: string }>(JUPYTER_LAB_SETUP_SCRIPT_API_URL).then(
    (response) => response.script
  );

/** Update JupyterLab setup script */
export const update = (payload: string) => {
  const formData = new FormData();
  formData.append("setup_script", payload);
  return fetcher<void>(JUPYTER_LAB_SETUP_SCRIPT_API_URL, {
    method: "POST",
    body: formData,
  });
};

export const jupyterLabSetupScriptApi = {
  fetchOne,
  update,
};
