import { TreeNode, UnpackedMove } from "@/pipeline-view/file-manager/common";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher } from "@orchest/lib-utils";

export const FILE_MANAGEMENT_ENDPOINT = "/async/file-management";

export type FetchNodeParams = {
  projectUuid: string;
  pipelineUuid?: string;
  jobUuid?: string;
  runUuid?: string;
  root: string;
  path?: string;
  depth?: number;
};

export type DeleteNodeParams = {
  projectUuid: string;
  root: string;
  path: string;
};

const fetchNode = (params: FetchNodeParams) =>
  fetcher<TreeNode>(
    join(FILE_MANAGEMENT_ENDPOINT, "browse") + "?" + queryArgs(prune(params))
  );

const deleteNode = (params: DeleteNodeParams) =>
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

export const filesApi = { fetchNode, deleteNode, moveNode };
