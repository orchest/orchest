import { GitConfig, SshKey } from "@/types";
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
  sshKeys: SshKey[] | undefined;
  getConfig: () => Promise<GitConfig | undefined>;
  updateConfig: (value: Omit<GitConfig, "uuid">) => Promise<GitConfig>;
  getSshKeys: () => Promise<SshKey[]>;
  createSshKey: (payload: { name: string; key: string }) => Promise<SshKey>;
  deleteSshKey: (sshKeyUuid: string) => Promise<void>;
};

export const useGitConfigsApi = create<GitConfigsApi>((set, get) => ({
  config: undefined,
  sshKeys: undefined,
  getConfig: async () => {
    const authUserUuid = getAuthUserUuid();
    const config = await gitConfigsApi.fetchGitConfig(authUserUuid);
    if (config) set({ config });
    return config;
  },
  updateConfig: async (value) => {
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
  getSshKeys: async () => {
    const authUserUuid = getAuthUserUuid();
    const sshKeys = await gitConfigsApi.fetchSshKeys(authUserUuid);
    set({ sshKeys });
    return sshKeys;
  },
  createSshKey: async (sshKeyValue) => {
    const authUserUuid = getAuthUserUuid();
    const sshKey = await gitConfigsApi.postSshKey(authUserUuid, sshKeyValue);
    set((state) => ({
      sshKeys: state.sshKeys ? [...state.sshKeys, sshKey] : [sshKey],
    }));
    return sshKey;
  },
  deleteSshKey: async (sshKeyUuid) => {
    const authUserUuid = getAuthUserUuid();
    await gitConfigsApi.deleteSshKey(authUserUuid, sshKeyUuid);
    set((state) => ({
      sshKeys: (state.sshKeys || []).filter(
        (sshKey) => sshKey.uuid !== sshKeyUuid
      ),
    }));
  },
}));
