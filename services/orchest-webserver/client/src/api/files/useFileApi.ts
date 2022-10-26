import {
  directoryLevel,
  TreeNode,
  UnpackedMove,
} from "@/pipeline-view/file-manager/common";
import { defineStoreScope } from "@/store/scoped";
import * as fileMap from "@/utils/file-map";
import { fileMetadata } from "@/utils/file-map";
import { dirname, isDirectory } from "@/utils/path";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { hasValue } from "@orchest/lib-utils";
import { filesApi } from "./fileApi";

export const fileRoots = ["/project-dir", "/data"] as const;

export type FileRoot = typeof fileRoots[number];

export type RootMap = Record<FileRoot, fileMap.FileMap>;

export type FileApi = {
  /** The currently available file maps, organized by root name. */
  roots: Record<string, fileMap.FileMap>;
  /**
   * Fetches the provided directory and merges its entries into its corresponding root.
   * If a file path is provided, its parent directory is fetched instead.
   */
  expand: MemoizePending<
    (root: string, directory?: string | undefined) => Promise<void>
  >;
  /**
   * Fetches (or reloads) all file roots up to a certain depth.
   * Anything deeper than the provided depth will be pruned in the updated roots.
   * @param depth How many levels of subdirectories to include, if omitted (or undefined) the current maximum depth of the root is used.
   */
  init: MemoizePending<
    (depth?: number) => Promise<Record<string, fileMap.FileMap>>
  >;
  delete: MemoizePending<(root: string, path: string) => Promise<void>>;
  move: MemoizePending<(move: UnpackedMove) => Promise<void>>;
  create: MemoizePending<(root: string, path: string) => Promise<void>>;
};

const create = defineStoreScope({
  requires: [],
  additional: ["projectUuid", "pipelineUuid", "jobUuid", "runUuid"],
});

export const useFileApi = create<FileApi>((set, get) => {
  const fetchNode = async (
    root: string,
    path: string | undefined,
    depth: number
  ) => {
    const { projectUuid, pipelineUuid, jobUuid, runUuid } = get();

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
    );

  return {
    roots: {},
    expand: memoizeFor(500, async (root, directory = "/") => {
      directory = isDirectory(directory) ? directory : dirname(directory);

      const node = await fetchNode(root, directory, 1);
      if (!node) return;

      const contents = Object.keys(createFileSet(node)).filter(
        (entry) => !isDirectory(directory) || entry !== directory
      );

      const { roots } = get();
      const newRoot = fileMap.replaceDirectoryContents(roots[root], contents);

      set({ roots: { ...roots, [root]: newRoot } });
    }),
    create: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get();

      if (!projectUuid) return;

      await filesApi.createNode({ root, path, projectUuid });

      set(({ roots }) => ({
        roots: {
          ...roots,
          [root]: fileMap.addToFileMap(roots[root], path),
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
          [root]: fileMap.removeFromFileMap(roots[root], path),
        },
      }));
    }),
    move: memoizeFor(500, async (move) => {
      const { projectUuid } = get();
      if (!projectUuid) return;

      await filesApi.moveNode(projectUuid, move);

      set(({ roots }) => ({ roots: fileMap.movePath(roots, move) }));
    }),
    init: memoizeFor(500, async (depth) => {
      const entries = await Promise.all(
        fileRoots.map((root) =>
          fetchNode(root, undefined, depth ?? getDepth(root) ?? 2)
            .then((node) => (!node ? undefined : ([root, node] as const)))
            .catch(() => undefined)
        )
      ).then((roots) => roots.filter(hasValue));

      const roots = Object.fromEntries(
        entries.map(([root, node]) => [root, createFileSet(node)])
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
export const createFileSet = (
  node: TreeNode,
  files: fileMap.FileMap = {}
): fileMap.FileMap => {
  const fetchedAt = Date.now();

  files[node.path] = fileMetadata(node.path, fetchedAt);

  if (node.children) {
    for (const child of node.children) {
      files[child.path] = fileMetadata(node.path, fetchedAt);

      createFileSet(child, files);
    }
  }

  return fileMap.sortFileMap(files);
};
