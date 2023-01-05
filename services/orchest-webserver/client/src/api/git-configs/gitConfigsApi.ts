import { GitConfig, SshKey } from "@/types";
import { join } from "@/utils/path";
import { omit } from "@/utils/record";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const GIT_CONFIGS_API_URL = "/catch/api-proxy/api/auth-users";

/** Fetches the git configs of an authenticated user.
 *  Although it returns a list, a user can only have one config max.
 * */
const fetchGitConfig = (authUserUuid: string): Promise<GitConfig | undefined> =>
  fetcher<{ git_configs: GitConfig[] }>(
    join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs")
  ).then((configs) => configs.git_configs[0]);

/**
 * Add a new set of username and email if user has not yet set any config.
 * If user attempts to post while user has already have one, BE will reject with 409.
 */
const postGitConfig = (
  authUserUuid: string,
  payload: Omit<GitConfig, "uuid">
) =>
  fetcher<GitConfig>(join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs"), {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify(payload),
  });

/** Modify the git username and email of the given UUID of the git config */
const putGitConfig = (
  authUserUuid: string,
  payload: GitConfig & { uuid: string }
) =>
  fetcher<GitConfig>(
    join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs", payload.uuid),
    {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify(omit(payload, "uuid")),
    }
  );

/** Delete the git config of the given UUID. Note that this endpoint is not exposed to UI. */
const deleteGitConfig = (authUserUuid: string, gitConfigUuid: string) =>
  fetcher<GitConfig>(
    join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs", gitConfigUuid),
    { method: "DELETE" }
  );

/** Fetches SSH keys of an authenticated user. */
const fetchSshKeys = (authUserUuid: string): Promise<SshKey[]> =>
  fetcher<{ ssh_keys: SshKey[] }>(
    join(GIT_CONFIGS_API_URL, authUserUuid, "ssh-keys")
  ).then((response) => response.ssh_keys);

/** Create a new SSH key of an authenticated user. */
const postSshKey = (
  authUserUuid: string,
  payload: { name: string; key: string }
): Promise<SshKey> =>
  fetcher<SshKey>(join(GIT_CONFIGS_API_URL, authUserUuid, "ssh-keys"), {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify(payload),
  });

/** Delete a SSH key of an authenticated user. */
const deleteSshKey = (
  authUserUuid: string,
  sshKeyUuid: string
): Promise<SshKey> =>
  fetcher(join(GIT_CONFIGS_API_URL, authUserUuid, "ssh-keys", sshKeyUuid), {
    method: "DELETE",
  });

export const gitConfigsApi = {
  fetchGitConfig,
  postGitConfig,
  putGitConfig,
  deleteGitConfig,
  fetchSshKeys,
  postSshKey,
  deleteSshKey,
};
