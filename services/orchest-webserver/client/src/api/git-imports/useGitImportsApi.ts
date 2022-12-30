import { GitImport } from "@/types";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { gitImportsApi } from "./gitImportsApi";

export type GitImportsApi = {
  import: MemoizePending<
    (url: string, projectName?: string) => Promise<GitImport>
  >;
  get: MemoizePending<(uuid: string) => Promise<GitImport>>;
};

export const useGitImportsApi = {
  import: memoizeFor(500, async (url: string, projectName: string) => {
    return await gitImportsApi.importGitRepo(url, projectName);
  }),
  get: memoizeFor(500, async (uuid) => {
    return await gitImportsApi.fetchOne(uuid);
  }),
};
