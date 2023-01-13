import { OrchestConfigs, OrchestUserConfig } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

const BASE_URL = "/async/server-config";

const fetchConfig = async (): Promise<OrchestConfigs> => {
  return fetcher<OrchestConfigs>(BASE_URL);
};

export type UpdateUserConfigResponse = {
  requires_restart: (keyof Partial<OrchestUserConfig>)[];
  user_config: OrchestUserConfig;
};

const updateUserConfig = (payload: OrchestUserConfig) =>
  fetcher<UpdateUserConfigResponse>("/async/user-config", {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({ config: JSON.stringify(payload) }),
  });

export const orchestConfigsApi = {
  fetch: fetchConfig,
  updateUserConfig,
};
