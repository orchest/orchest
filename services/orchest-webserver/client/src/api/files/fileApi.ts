import { UnpackedMove } from "@/utils/file";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher } from "@orchest/lib-utils";

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

export type NodeParams = {
  projectUuid: string;
  root: string;
  path: string;
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
  await fetch(
    join(FILE_MANAGEMENT_ENDPOINT, "duplicate") +
      "?" +
      queryArgs({ path, root, projectUuid }),
    { method: "POST" }
  );

export const filesApi = {
  fetchNode,
  deleteNode,
  moveNode,
  createFile,
  duplicate,
  createDirectory,
};
