import { GitConfig } from "@/types";
import { join } from "@/utils/path";
import { omit } from "@/utils/record";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const GIT_CONFIGS_API_URL = "/catch/api-proxy/api/auth-users";

/** Fetches the git configs of an authenticated user.
 *  Although it returns a list, a user can only have one config max.
 * */
export const fetchGitConfig = (
  authUserUuid: string
): Promise<GitConfig | undefined> =>
  fetcher<{ git_configs: GitConfig[] }>(
    join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs")
  ).then((configs) => configs.git_configs[0]);

/**
 * Add a new set of username and email if user has not yet set any config.
 * If user attempts to post while user has already have one, BE will reject with 409.
 */
export const postGitConfig = (
  authUserUuid: string,
  payload: Omit<GitConfig, "uuid">
) =>
  fetcher<GitConfig>(join(GIT_CONFIGS_API_URL, authUserUuid, "git-configs"), {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify(payload),
  });

/** Modify the git username and email of the given UUID of the git config */
export const putGitConfig = (authUserUuid: string, payload: GitConfig) =>
  fetcher<GitConfig>(
    `${GIT_CONFIGS_API_URL}/${authUserUuid}/git-configs/${payload.uuid}`,
    {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify(omit(payload, "uuid")),
    }
  );

export const gitConfigsApi = {
  fetchGitConfig,
  postGitConfig,
  putGitConfig,
};
