import { FileRoot, fileRoots, UnpackedMove } from "@/utils/file";
import {
  addToFileMap,
  FileMap,
  fileMapDepth,
  fileMetadata,
  moveBetween,
  removeFromFileMap,
  replaceDirectoryContents,
  sortFileMap,
} from "@/utils/file-map";
import { dirname, isDirectory, join, trimLeadingSlash } from "@/utils/path";
import { memoizeFor, MemoizePending } from "@/utils/promise";
import { hasValue } from "@orchest/lib-utils";
import create from "zustand";
import { ExtensionSearchParams, filesApi, TreeNode } from "./fileApi";

export type FetchNodeParams = {
  root: FileRoot;
  path: string | undefined;
  depth: number;
  overrides?: FileScope;
};

type FileRoots = Partial<Record<FileRoot, FileMap>>;
type FileRootEntry = readonly [FileRoot, FileMap];

export type FileApi = {
  /** The currently available file maps, organized by root name. */
  roots: FileRoots;
  /** Defines which project and pipeline, job, run or snapshot the files are from. */
  scope: FileScope;
  /**
   * Fetches the provided directory and merges its entries into its corresponding root.
   * If a file path is provided, its parent directory is fetched instead.
   */
  expand: MemoizePending<
    (
      root: FileRoot,
      directory?: string | undefined,
      overrides?: FileScope
    ) => Promise<void>
  >;
  /** Reloads the available file roots up to their maximum expanded depth. */
  refresh: MemoizePending<() => Promise<void>>;
  /**
   * Fetches (or reloads) all file roots up to a certain depth.
   * Anything deeper than the provided depth will be pruned in the updated roots.
   * @param depth How many levels of subdirectories to include, if omitted (or undefined) the current maximum depth of the root is used.
   */
  init: MemoizePending<
    (depth: number, scope: FileScope) => Promise<Record<string, FileMap>>
  >;
  delete: MemoizePending<(root: FileRoot, path: string) => Promise<void>>;
  move: MemoizePending<(move: UnpackedMove) => Promise<void>>;
  duplicate: MemoizePending<(root: FileRoot, path: string) => Promise<void>>;
  /**
   * Creates a file or directory with the specified path.
   * Paths that end with `"/"` are considered directories.
   * @root The root to create the file or directory in.
   * @path The path of the file or directory.
   */
  create: MemoizePending<(root: FileRoot, path: string) => Promise<void>>;

  extensionSearch: MemoizePending<
    (params: Omit<ExtensionSearchParams, "projectUuid">) => Promise<string[]>
  >;

  read: MemoizePending<(root: FileRoot, path: string) => Promise<string>>;
};

export type FileScope = {
  projectUuid?: string;
  jobUuid?: string;
  runUuid?: string;
  pipelineUuid?: string;
  snapshotUuid?: string;
};

export const useFileApi = create<FileApi>((set, get) => {
  const fetchNode = ({
    root,
    path,
    depth,
  }: FetchNodeParams): Promise<TreeNode | undefined> => {
    const { projectUuid, ...scope } = get().scope;

    if (!projectUuid) return Promise.resolve(undefined);

    return filesApi.fetchNode({ ...scope, projectUuid, root, path, depth });
  };

  const getDepth = (root: string) => fileMapDepth(get().roots[root] ?? {});

  const updateRoot = (
    root: FileRoot,
    factory: (fileMap: FileMap) => FileMap
  ) => {
    const roots = get().roots;
    const fileMap = roots[root] ?? {};

    set({ roots: { ...roots, [root]: factory(fileMap) } });
  };

  const expand = async (root: FileRoot, directory = "/") => {
    directory = isDirectory(directory) ? directory : dirname(directory);

    const node = await fetchNode({ root, path: directory, depth: 1 });

    if (!node) return;

    const contents = Object.keys(createFileMap(node)).filter(
      (entry) => !isDirectory(directory) || entry !== directory
    );

    updateRoot(root, (fileMap) => replaceDirectoryContents(fileMap, contents));
  };

  return {
    roots: {},
    scope: {},
    expand: memoizeFor(500, expand),
    create: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get().scope;

      if (!projectUuid) return;

      if (isDirectory(path)) {
        await filesApi.createDirectory({ root, path, projectUuid });
      } else {
        await filesApi.createFile({ root, path, projectUuid });
      }

      updateRoot(root, (fileMap) => addToFileMap(fileMap, path));
    }),
    delete: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get().scope;

      if (!projectUuid) return;

      await filesApi.deleteNode({ projectUuid, root, path });

      updateRoot(root, (fileMap) => removeFromFileMap(fileMap, path));
    }),
    move: memoizeFor(500, async (move) => {
      const { projectUuid } = get().scope;

      if (!projectUuid) return;

      await filesApi.moveNode(projectUuid, move);

      set(({ roots }) => ({ roots: moveBetween(roots, move) }));
    }),
    duplicate: memoizeFor(500, async (root, path) => {
      const { projectUuid } = get().scope;

      if (!projectUuid) return;

      await filesApi.duplicate(projectUuid, root, path);
      await expand(root, dirname(path));
    }),
    init: memoizeFor(500, async (depth, scope) => {
      set({ scope });

      const entries = await Promise.all(
        fileRoots.map((root) =>
          fetchNode({ root, path: "/", depth })
            .then((node) => (!node ? undefined : ([root, node] as const)))
            .catch(() => undefined)
        )
      ).then((roots) => roots.filter(hasValue));

      const roots = Object.fromEntries(
        entries.map(([root, node]) => createRootEntry(root, node))
      );

      set({ roots });

      return roots;
    }),
    refresh: memoizeFor(500, async () => {
      const entries = await Promise.all(
        fileRoots.map((root) =>
          fetchNode({ root, path: "/", depth: getDepth(root) ?? 2 })
            .then((node) => (!node ? undefined : ([root, node] as const)))
            .catch(() => undefined)
        )
      ).then((roots) => roots.filter(hasValue));

      const roots = Object.fromEntries(
        entries.map(([root, node]) => createRootEntry(root, node))
      );

      set({ roots });
    }),
    extensionSearch: memoizeFor(500, async (params) => {
      const { projectUuid } = get().scope;

      if (!projectUuid) return [];

      const paths = await filesApi.extensionSearch({ projectUuid, ...params });

      updateRoot(params.root, (fileMap) => addToFileMap(fileMap, ...paths));

      return paths;
    }),
    read: memoizeFor(500, async (root, path) => {
      const { scope } = get();
      const { projectUuid } = scope;

      if (!hasValue(projectUuid)) {
        throw new Error("A project is not in scope.");
      }

      return await filesApi.readFile({
        ...scope,
        projectUuid,
        path: root === "/data" ? join(root, path) : trimLeadingSlash(path),
      });
    }),
  };
});

const createRootEntry = (root: FileRoot, node: TreeNode): FileRootEntry => [
  root,
  createFileMap(node),
];

/**
 * Flattens the file tree into a map of files,
 * to make state manipulation easier.
 */
const createFileMap = (node: TreeNode, fileMap: FileMap = {}): FileMap => {
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
