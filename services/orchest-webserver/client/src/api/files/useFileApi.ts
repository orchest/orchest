import { defineStoreScope } from "@/store/scoped";
import { FileRoot, fileRoots, UnpackedMove } from "@/utils/file";
import {
  addToFileMap,
  FileMap,
  fileMetadata,
  moveBetween,
  removeFromFileMap,
  replaceDirectoryContents,
  sortFileMap,
} from "@/utils/file-map";
import { directoryLevel, dirname, isDirectory } from "@/utils/path";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { prune } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import { filesApi, TreeNode } from "./fileApi";

export type FetchNodeParams = {
  root: string;
  path: string | undefined;
  depth: number;
  overrides?: FileApiOverrides;
};

export type FileApi = {
  /** The currently available file maps, organized by root name. */
  roots: Record<string, FileMap>;
  /**
   * Fetches the provided directory and merges its entries into its corresponding root.
   * If a file path is provided, its parent directory is fetched instead.
   */
  expand: MemoizePending<
    (
      root: FileRoot,
      directory?: string | undefined,
      overrides?: FileApiOverrides
    ) => Promise<void>
  >;
  /**
   * Fetches (or reloads) all file roots up to a certain depth.
   * Anything deeper than the provided depth will be pruned in the updated roots.
   * @param depth How many levels of subdirectories to include, if omitted (or undefined) the current maximum depth of the root is used.
   */
  init: MemoizePending<
    (
      depth?: number,
      overrides?: FileApiOverrides
    ) => Promise<Record<string, FileMap>>
  >;
  delete: MemoizePending<(root: string, path: string) => Promise<void>>;
  move: MemoizePending<(move: UnpackedMove) => Promise<void>>;
  create: MemoizePending<(root: string, path: string) => Promise<void>>;
};

const additionalScope = ["jobUuid", "runUuid", "pipelineUuid"] as const;

const create = defineStoreScope({
  requires: ["projectUuid"],
  additional: additionalScope,
});

export type FileApiOverrides = {
  jobUuid?: string;
  runUuid?: string;
  pipelineUuid?: string;
};

export const useFileApi = create<FileApi>((set, get) => {
  const fetchNode = async ({
    root,
    path,
    depth,
    overrides,
  }: FetchNodeParams) => {
    const { projectUuid, pipelineUuid, jobUuid, runUuid } = prune({
      ...get(),
      ...overrides,
    });

    if (!projectUuid) return undefined;

    return await filesApi.fetchNode({
      root,
      path,
      depth,
      projectUuid,
      pipelineUuid,
      jobUuid,
      runUuid,
    });
  };

  const getDepth = (root: string) =>
    Object.keys(get().roots[root] ?? {}).reduce(
      (depth, path) => Math.max(depth, directoryLevel(path)),
      0
    ) + 1;

  return {
    roots: {},
    expand: memoizeFor(500, async (root, directory = "/", overrides) => {
      directory = isDirectory(directory) ? directory : dirname(directory);

      const node = await fetchNode({
        root,
        path: directory,
        depth: 1,
        overrides,
      });
      if (!node) return;

      const contents = Object.keys(createFileMap(node)).filter(
        (entry) => !isDirectory(directory) || entry !== directory
      );

      const { roots } = get();
      const newRoot = replaceDirectoryContents(roots[root], contents);

      set({ roots: { ...roots, [root]: newRoot } });
    }),
    create: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get();

      if (!projectUuid) return;

      await filesApi.createNode({ root, path, projectUuid });

      set(({ roots }) => ({
        roots: {
          ...roots,
          [root]: addToFileMap(roots[root], path),
        },
      }));
    }),
    delete: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get();
      if (!projectUuid) return;

      await filesApi.deleteNode({ projectUuid, root, path });

      set(({ roots }) => ({
        roots: {
          ...roots,
          [root]: removeFromFileMap(roots[root], path),
        },
      }));
    }),
    move: memoizeFor(500, async (move) => {
      const { projectUuid } = get();
      if (!projectUuid) return;

      await filesApi.moveNode(projectUuid, move);

      set(({ roots }) => ({ roots: moveBetween(roots, move) }));
    }),
    init: memoizeFor(500, async (depth, overrides) => {
      const entries = await Promise.all(
        fileRoots.map((root) =>
          fetchNode({
            root,
            path: "/",
            depth: depth ?? getDepth(root) ?? 2,
            overrides,
          })
            .then((node) => (!node ? undefined : ([root, node] as const)))
            .catch(() => undefined)
        )
      ).then((roots) => roots.filter(hasValue));

      const roots = Object.fromEntries(
        entries.map(([root, node]) => [root, createFileMap(node)])
      );

      set({ roots });

      return roots;
    }),
  };
});

/**
 * Flattens the file tree into a map of files,
 * to make state manipulation easier.
 */
export const createFileMap = (
  node: TreeNode,
  fileMap: FileMap = {}
): FileMap => {
  const fetchedAt = Date.now();

  fileMap[node.path] = fileMetadata(node.path, fetchedAt);

  if (node.children) {
    for (const child of node.children) {
      fileMap[child.path] = fileMetadata(node.path, fetchedAt);

      createFileMap(child, fileMap);
    }
  }

  return sortFileMap(fileMap);
};
