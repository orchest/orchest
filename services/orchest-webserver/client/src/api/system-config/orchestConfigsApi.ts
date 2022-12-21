import { OrchestConfigs } from "@/types";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/async/server-config";

const fetchConfig = async (): Promise<OrchestConfigs> => {
  return fetcher<OrchestConfigs>(BASE_URL);
};

export const orchestConfigsApi = {
  fetch: fetchConfig,
};
