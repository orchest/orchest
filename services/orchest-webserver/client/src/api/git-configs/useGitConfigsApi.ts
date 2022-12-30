import { GitConfig } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import cookie from "js-cookie";
import create from "zustand";
import { gitConfigsApi } from "./gitConfigsApi";

const COOKIE_KEY_AUTH_USER_UUID = "auth_user_uuid";

const getAuthUserUuid = () => {
  const authUserUuid = cookie.get(COOKIE_KEY_AUTH_USER_UUID);
  if (!authUserUuid) throw new FetchError("User is not yet authenticated.");
  return authUserUuid;
};

export type GitConfigsApi = {
  config: GitConfig | undefined;
  get: () => Promise<GitConfig | undefined>;
  update: (value: Omit<GitConfig, "uuid">) => Promise<GitConfig>;
};

export const useGitConfigsApi = create<GitConfigsApi>((set, get) => ({
  config: undefined,
  get: async () => {
    const authUserUuid = getAuthUserUuid();
    const config = await gitConfigsApi.fetchGitConfig(authUserUuid);
    if (config) set({ config });
    return config;
  },
  update: async (value) => {
    const authUserUuid = getAuthUserUuid();
    const existingConfig = get().config;
    const config = !existingConfig
      ? await gitConfigsApi.postGitConfig(authUserUuid, value)
      : await gitConfigsApi.putGitConfig(authUserUuid, {
          ...value,
          uuid: existingConfig.uuid,
        });
    set({ config });
    return config;
  },
}));
