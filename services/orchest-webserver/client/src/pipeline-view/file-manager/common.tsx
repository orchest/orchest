import { Code } from "@/components/common/Code";
import { StepData } from "@/types";
import {
  basename,
  dirname,
  hasAncestor,
  hasExtension,
  isDirectory,
  join,
  relative,
} from "@/utils/path";
import { queryArgs } from "@/utils/text";
import { ALLOWED_STEP_EXTENSIONS, fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot } from "../common";

export type FileTrees = Record<string, TreeNode>;

export const FILE_MANAGEMENT_ENDPOINT = "/async/file-management";
export const FILE_MANAGER_ROOT_CLASS = "file-manager-root";

export type TreeNode = {
  children: TreeNode[];
  path: string;
  type: "directory" | "file";
  name: string;
  root: boolean;
};

export const searchTree = (
  path: string,
  tree: TreeNode,
  res: { parent?: TreeNode; node?: TreeNode } = {}
) => {
  for (const node of tree.children) {
    if (node.path === path) {
      res.parent = tree;
      res.node = node;
      break;
    } else if (node.children) {
      searchTree(path, node, res);
    }
  }
  return res;
};

export const ROOT_SEPARATOR = ":";

export type UnpackedPath = {
  /** Either `/project-dir` or `/data` */
  root: FileManagementRoot;
  /** The path to the file, always starts with "/" */
  path: string;
};

/** Returns true if the path has the `.orchest` extension. */
export const isPipelineFile = (path: string) => hasExtension(path, "orchest");

/** Returns true if the combined path is in the `/data:` file management root. */
export const isInDataFolder = (combinedPath: string) =>
  /^\/data\:?\//.test(combinedPath);

/** Returns true if the combined path is in the `/project-dir:` file management root. */
export const isInProjectFolder = (combinedPath: string) =>
  /^\/project-dir\:?\//.test(combinedPath);

/**
 * Unpacks an combined path into `root` and `path`.
 * For example `/project-dir:/a/b` will unpack into `/project-dir:` and `/a/b/`.
 *
 * Note: If the path provided is not a combined path, this function may return
 * something nonsensical. You can use `isCombinedPath` to check.
 */
export const unpackPath = (combinedPath: string): UnpackedPath => {
  const root = combinedPath.split(":")[0] as FileManagementRoot;
  const path = combinedPath.slice(root.length + ROOT_SEPARATOR.length);

  return { root, path };
};

export const isCombinedPath = (path: string) => /^\/([a-z]|\-)+:\//.test(path);

export const combinePath = ({ root, path }: UnpackedPath) =>
  join(root + ROOT_SEPARATOR, path);

/**
 * A tuple that describes a move.
 * The first value is the old path,
 * the second is the new path.
 */
export type Move = readonly [string, string];

export type UnpackedMove = {
  oldRoot: FileManagementRoot;
  oldPath: string;
  newRoot: FileManagementRoot;
  newPath: string;
};

export const isRename = (moves: readonly Move[]) =>
  moves.length === 1 && dirname(moves[0][0]) === dirname(moves[0][1]);

export const unpackMove = ([source, target]: Move): UnpackedMove => {
  const { root: oldRoot, path: oldPath } = unpackPath(source);
  const { root: newRoot, path: newPath } = unpackPath(target);

  return { oldRoot, oldPath, newRoot, newPath };
};

export const getMoveFromDrop = (sourcePath: string, dropPath: string): Move => {
  if (sourcePath === dropPath || dropPath.startsWith(sourcePath)) {
    return [sourcePath, sourcePath];
  }

  const isSourceDir = isDirectory(sourcePath);
  const isTargetDir = isDirectory(dropPath);

  const sourceBasename = basename(sourcePath);
  const dropFolderPath = isTargetDir ? dropPath : dirname(dropPath);

  const newPath = dropFolderPath + sourceBasename + (isSourceDir ? "/" : "");

  return [sourcePath, newPath];
};

export function isDirectoryEntry(
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

export function isFileEntry(
  entry: FileSystemEntry
): entry is FileSystemFileEntry {
  return entry.isFile;
}

export const mergeTrees = (subTree: TreeNode, tree: TreeNode) => {
  const { parent } = searchTree(subTree.path, tree);
  if (!parent) return;
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.path === subTree.path) {
      parent.children[i] = subTree;
      break;
    }
  }
};

export const getActiveRoot = (
  selected: string[],
  treeRoots: readonly FileManagementRoot[]
): FileManagementRoot => {
  if (selected.length === 0) {
    return treeRoots[0];
  } else {
    return unpackPath(selected[0]).root;
  }
};

const isPathChildless = (path: string, tree: TreeNode) => {
  const { node } = searchTree(path, tree);

  return Boolean(node?.children.length);
};

export const isCombinedPathChildless = (
  combinedPath: string,
  roots: FileTrees
) => {
  const { root, path } = unpackPath(combinedPath);

  return isPathChildless(path, roots[root]);
};

export const searchTrees = ({
  combinedPath,
  treeRoots,
  fileTrees,
}: {
  combinedPath: string;
  treeRoots: readonly FileManagementRoot[];
  fileTrees: Record<string, TreeNode>;
}) => {
  if (treeRoots.includes(combinedPath as FileManagementRoot)) {
    return { node: combinedPath };
  }

  let { root, path } = unpackPath(combinedPath);
  if (!fileTrees[root]) {
    return {};
  }

  let result = searchTree(path, fileTrees[root]);
  if (result.node !== undefined) {
    return result;
  } else {
    return {};
  }
};

export const cleanFilePath = (filePath: string, replaceProjectDirWith = "") =>
  filePath
    .replace(/^\/project-dir\:\//, replaceProjectDirWith)
    .replace(/^\/data\:\//, "/data/");

/** Prettifies the root name for display purposes. */
export const prettifyRoot = (root: string) => {
  switch (root) {
    case "project-dir:":
    case "/project-dir":
      return "Project files";
    case "data:":
      return "/data";
    default:
      return root;
  }
};

/** Remove leading "./" of a file path */
export const removeLeadingSymbols = (filePath: string) =>
  filePath.replace(/^\.\//, "");

// user might enter "./foo.ipynb", but it's equivalent to "foo.ipynb".
// this function cleans up the leading "./"
export const getStepFilePath = (step: StepData) =>
  removeLeadingSymbols(step.file_path);

export const searchFilePathsByExtension = ({
  projectUuid,
  root,
  path,
  extensions,
}: {
  projectUuid: string;
  root: string;
  path: string;
  extensions: string[];
}) => {
  const query = queryArgs({
    projectUuid,
    root,
    path,
    extensions: extensions.join(","),
  });

  return fetcher<{ files: string[] }>(
    `${FILE_MANAGEMENT_ENDPOINT}/extension-search?` + query
  );
};

/** This function returns a list of file_path that ends with the given extensions. */
export const findFilesByExtension = async ({
  root,
  projectUuid,
  extensions,
  node,
}: {
  root: FileManagementRoot;
  projectUuid: string;
  extensions: string[];
  node: TreeNode;
}) => {
  if (node.type === "file") {
    const isFileType = hasExtension(node.name, ...extensions);
    return isFileType ? [node.name] : [];
  } else if (node.type === "directory") {
    const response = await searchFilePathsByExtension({
      projectUuid,
      root,
      path: node.path,
      extensions,
    });

    return response.files;
  }
  return [];
};

/**
 * Notebook files cannot be reused in the same pipeline, this function separate Notebook files that are already in use
 * from all the other allowed files
 */
export const validateFiles = (
  currentStepUuid: string | undefined,
  steps: Record<string, StepData> | undefined,
  selectedFiles: string[]
) => {
  const allNotebookFileSteps = Object.values(steps || {}).reduce(
    (all, step) => {
      const filePath = getStepFilePath(step);
      if (hasExtension(filePath, "ipynb")) {
        return [...all, { ...step, file_path: filePath }];
      }
      return all;
    },
    [] as StepData[]
  );

  return selectedFiles.reduce(
    (all, curr) => {
      const usedNotebookFiles = allNotebookFileSteps.find((step) => {
        return (
          step.file_path === cleanFilePath(curr) &&
          currentStepUuid !== step.uuid // assigning the same file to the same step is allowed
        );
      });

      return usedNotebookFiles
        ? {
            ...all,
            usedNotebookFiles: [...all.usedNotebookFiles, cleanFilePath(curr)],
          }
        : !hasExtension(curr, ...ALLOWED_STEP_EXTENSIONS)
        ? { ...all, forbidden: [...all.forbidden, cleanFilePath(curr)] }
        : { ...all, allowed: [...all.allowed, cleanFilePath(curr)] };
    },
    {
      usedNotebookFiles: [] as string[],
      forbidden: [] as string[],
      allowed: [] as string[],
    }
  );
};

export const allowedExtensionsMarkup = ALLOWED_STEP_EXTENSIONS.map(
  (el, index) => {
    return (
      <span key={el}>
        <Code>.{el}</Code>
        {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? <>&nbsp;, </> : ""}
      </span>
    );
  }
);

export const findFirstDiffIndex = (arrA: string[], arrB: string[]) => {
  const range = Math.min(arrA.length, arrB.length);
  let i = 0;
  while (i < range && arrA[i] === arrB[i]) i++;
  return i;
};

export const pathFromElement = (element: HTMLElement): string | undefined => {
  const path = element.getAttribute("data-path");
  if (path) {
    return path;
  } else if (element.parentElement) {
    return pathFromElement(element.parentElement);
  } else {
    return undefined;
  }
};

const getFilePathInDataFolder = (dragFilePath: string) =>
  cleanFilePath(dragFilePath);

export const getFilePathRelativeToPipeline = (
  fullFilePath: string | undefined,
  pipelineCwd: string
) => {
  if (!hasValue(fullFilePath)) return pipelineCwd;
  return isInDataFolder(fullFilePath)
    ? getFilePathInDataFolder(fullFilePath)
    : relative(pipelineCwd, cleanFilePath(fullFilePath));
};

export const lastSelectedFolderPath = (selectedFiles: string[]) => {
  if (selectedFiles.length === 0) return "/";
  // Note that the selection order in selectedFiles is backward,
  // so we don't need to find from end
  const lastSelected = selectedFiles[0];

  // example:
  // given:     /project-dir:/hello-world/foo/bar.py
  // outcome:   /hello-world/foo/
  const matches = lastSelected.match(/^\/[^\/]+:((\/[^\/]+)*\/)([^\/]*)/);
  return matches ? matches[1] : "/";
};

/**
 * This function removes the child path if its ancestor path already appears in the list.
 * e.g. given selection ["/a/", "/a/b.py"], "/a/b.py" should be removed.
 */
export const filterRedundantChildPaths = (paths: readonly string[]) => {
  const ancestors: string[] = [];

  // Sort the list so that ancestors are traversed first.
  for (const path of [...paths].sort()) {
    const isIncluded = !ancestors.some(
      (ancestor) => hasAncestor(path, ancestor) || path === ancestor
    );

    if (isIncluded) {
      ancestors.push(path);
    }
  }

  return ancestors;
};

export const findPipelineFiles = async (
  projectUuid: string,
  filePaths: UnpackedPath[]
): Promise<UnpackedPath[]> => {
  const paths = await Promise.all(
    filePaths.map(({ root, path }) => {
      if (isDirectory(path)) {
        return searchFilePathsByExtension({
          projectUuid,
          extensions: ["orchest"],
          root,
          path,
        }).then((response) =>
          response.files.map((file) => ({
            root,
            path: `/${file}`,
          }))
        );
      } else {
        return isPipelineFile(path) ? { root, path } : null;
      }
    })
  );

  return paths
    .filter((value) => hasValue(value))
    .flatMap((value) => value as UnpackedPath);
};
