import { FileRoot, UnpackedMove } from "@/utils/file";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher, FetchError } from "@orchest/lib-utils";

export const FILE_MANAGEMENT_ENDPOINT = "/async/file-management";

export type TreeNode = {
  children: TreeNode[];
  path: string;
  type: "directory" | "file";
  name: string;
  root: boolean;
};

export type FetchNodeParams = {
  projectUuid: string;
  pipelineUuid?: string;
  snapshotUuid?: string;
  jobUuid?: string;
  runUuid?: string;
  root: string;
  path?: string;
  depth?: number;
};

export type ReadFileParams = {
  projectUuid: string;
  pipelineUuid?: string;
  snapshotUuid?: string;
  jobUuid?: string;
  runUuid?: string;
  path?: string;
};

export type NodeParams = {
  projectUuid: string;
  root: string;
  path: string;
};

export type ExtensionSearchParams = {
  projectUuid: string;
  root: FileRoot;
  path: string;
  extensions: string[];
};

const fetchNode = (params: FetchNodeParams) =>
  fetcher<TreeNode>(
    join(FILE_MANAGEMENT_ENDPOINT, "browse") + "?" + queryArgs(prune(params))
  );

const deleteNode = (params: NodeParams) =>
  fetcher<void>(
    join(FILE_MANAGEMENT_ENDPOINT, "delete") + "?" + queryArgs(params),
    { method: "POST" }
  );

const moveNode = async (projectUuid: string, move: UnpackedMove) => {
  const query = queryArgs({ ...move, projectUuid });

  await fetcher(join(FILE_MANAGEMENT_ENDPOINT, "rename") + "?" + query, {
    method: "POST",
  });
};

const createFile = async (params: NodeParams) => {
  await fetcher(
    join(FILE_MANAGEMENT_ENDPOINT, "create") + "?" + queryArgs(params),
    { method: "POST" }
  );
};

const createDirectory = async (params: NodeParams) => {
  await fetcher(
    join(FILE_MANAGEMENT_ENDPOINT, "create-dir") + "?" + queryArgs(params),
    { method: "POST" }
  );
};

const duplicate = async (projectUuid: string, root: string, path: string) =>
  await fetcher<void>(
    join(FILE_MANAGEMENT_ENDPOINT, "duplicate") +
      "?" +
      queryArgs({ path, root, projectUuid }),
    { method: "POST" }
  );

const extensionSearch = ({ projectUuid, root, path, extensions }) =>
  fetcher<{ files: string[] }>(
    join(FILE_MANAGEMENT_ENDPOINT, "extension-search") +
      "?" +
      queryArgs({ projectUuid, root, path, extensions: extensions.join(",") })
  ).then((data) => data.files);

const readFile = (params: ReadFileParams) =>
  fetch(
    join(FILE_MANAGEMENT_ENDPOINT, "read") + "?" + queryArgs(params)
  ).then((res) =>
    res.ok ? res.text() : Promise.reject(FetchError.fromResponse(res))
  );

const getDownloadUrl = (projectUuid: string, root: string, path: string) =>
  join(FILE_MANAGEMENT_ENDPOINT, "download") +
  "?" +
  queryArgs({ path, root, projectUuid });

const downloadFile = (projectUuid: string, root: string, path: string) =>
  fetch(getDownloadUrl(projectUuid, root, path)).then((res) => res.text());

export const filesApi = {
  fetchNode,
  deleteNode,
  moveNode,
  createFile,
  duplicate,
  createDirectory,
  downloadFile,
  readFile,
  getDownloadUrl,
  extensionSearch,
};
