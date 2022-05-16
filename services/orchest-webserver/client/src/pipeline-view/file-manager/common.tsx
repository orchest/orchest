import { Code } from "@/components/common/Code";
import { Step } from "@/types";
import {
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  hasValue,
} from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot } from "../common";

export type FileTrees = Record<string, TreeNode>;

export const FILE_MANAGEMENT_ENDPOINT = "/async/file-management";
export const FILE_MANAGER_ROOT_CLASS = "file-manager-root";
export const ROOT_SEPARATOR = ":";

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
  // This search returns early
  for (let x = 0; x < tree.children.length; x++) {
    let node = tree.children[x];
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

/**
 * `path` always starts with "/"
 */
export type UnpackedPath = { root: FileManagementRoot; path: string };

export const unpackCombinedPath = (combinedPath: string): UnpackedPath => {
  // combinedPath includes the root
  // e.g. /project-dir:/abc/def
  // => root: /project-dir
  // => path: /abc/def

  let root = combinedPath.split(ROOT_SEPARATOR)[0] as FileManagementRoot;
  let path = combinedPath.slice(root.length + ROOT_SEPARATOR.length);
  return { root, path };
};

export const createCombinedPath = (root: string, path: string) => {
  return root + ROOT_SEPARATOR + path;
};

export const baseNameFromPath = (combinedPath: string) => {
  const { root, path } = unpackCombinedPath(combinedPath);

  let baseName = path.endsWith("/")
    ? path.split("/").slice(-2)[0]
    : path.split("/").slice(-1)[0];

  return baseName === "" ? root.slice(1) : baseName;
};

export const deriveParentPath = (path: string) => {
  return path.endsWith("/")
    ? path.split("/").slice(0, -2).join("/") + "/"
    : path.split("/").slice(0, -1).join("/") + "/";
};

export const generateTargetDescription = (path: string) => {
  let parentPath = deriveParentPath(path);
  let nameFromPath = baseNameFromPath(parentPath);

  return (
    <Code>
      {nameFromPath === "project-dir" ? "Project files" : nameFromPath}
    </Code>
  );
};

const getFolderPathOfFile = (path: string) =>
  `${path.split("/").slice(0, -1).join("/")}/`;

export const deduceRenameFromDragOperation = (
  sourcePath: string,
  targetPath: string
): [string, string] => {
  // Check if target is sourceDir or a child of sourceDir
  if (sourcePath === targetPath || targetPath.startsWith(sourcePath)) {
    // Break out with no-op. Illegal move
    return [sourcePath, sourcePath];
  }

  const isSourceDir = sourcePath.endsWith("/");
  const isTargetDir = targetPath.endsWith("/");

  const sourceBasename = baseNameFromPath(sourcePath);
  const targetFolderPath = isTargetDir
    ? targetPath
    : getFolderPathOfFile(targetPath);

  const newPath = `${targetFolderPath}${sourceBasename}${
    isSourceDir ? "/" : ""
  }`;

  return [sourcePath, newPath];
};

/**
 * File API functions
 */

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
  // Modifies tree
  // subTree root path
  let { parent } = searchTree(subTree.path, tree);
  if (!parent) return;
  for (let x = 0; x < parent.children.length; x++) {
    let child = parent.children[x];
    if (child.path === subTree.path) {
      parent.children[x] = subTree;
      break;
    }
  }
};

export const queryArgs = (obj: Record<string, string | number | boolean>) => {
  return Object.entries(obj).reduce((str, [key, value]) => {
    const leadingCharts = str === "" ? str : `${str}&`;
    return `${leadingCharts}${key}=${window.encodeURIComponent(value)}`;
  }, "");
};

/**
 * Path helpers
 */

export const getActiveRoot = (
  selected: string[],
  treeRoots: FileManagementRoot[]
): FileManagementRoot => {
  if (selected.length === 0) {
    return treeRoots[0];
  } else {
    const { root } = unpackCombinedPath(selected[0]);
    return root as FileManagementRoot;
  }
};

const isPathChildLess = (path: string, fileTree: TreeNode) => {
  let { node } = searchTree(path, fileTree);
  if (!node) {
    return false;
  } else {
    return node.children.length === 0;
  }
};
export const isCombinedPathChildLess = (
  combinedPath: string,
  fileTrees: FileTrees
) => {
  let { root, path } = unpackCombinedPath(combinedPath);
  return isPathChildLess(path, fileTrees[root]);
};

export const searchTrees = ({
  combinedPath,
  treeRoots,
  fileTrees,
}: {
  combinedPath: string;
  treeRoots: string[];
  fileTrees: Record<string, TreeNode>;
}) => {
  if (treeRoots.includes(combinedPath)) {
    return { node: combinedPath };
  }

  let { root, path } = unpackCombinedPath(combinedPath);
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

/**
 * remove leading "./" of a file path
 * @param filePath {string}
 * @returns {string}
 */
export const removeLeadingSymbols = (filePath: string) =>
  filePath.replace(/^\.\//, "");

// user might enter "./foo.ipynb", but it's equivalent to "foo.ipynb".
// this function cleans up the leading "./"
export const getStepFilePath = (step: Step) =>
  removeLeadingSymbols(step.file_path);

export const isFileByExtension = (extensions: string[], filePath: string) => {
  const regex = new RegExp(
    `\.(${extensions
      .map((extension) => extension.replace(/^\./, "")) // in case user add a leading dot
      .join("|")})$`,
    "i"
  );
  return regex.test(filePath);
};

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
}) =>
  fetcher<{ files: string[] }>(
    `${FILE_MANAGEMENT_ENDPOINT}/extension-search?${queryArgs({
      project_uuid: projectUuid,
      root,
      path,
      extensions: extensions.join(","),
    })}`
  );

/**
 * This function returns a list of file_path that ends with the given extensions.
 */
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
    const isFileType = isFileByExtension(extensions, node.name);
    return isFileType ? [node.name] : [];
  }
  if (node.type === "directory") {
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
  steps: Record<string, Step> | undefined,
  selectedFiles: string[]
) => {
  const allNotebookFileSteps = Object.values(steps || {}).reduce(
    (all, step) => {
      const filePath = getStepFilePath(step);
      if (isFileByExtension(["ipynb"], filePath)) {
        return [...all, { ...step, file_path: filePath }];
      }
      return all;
    },
    [] as Step[]
  );

  return selectedFiles.reduce(
    (all, curr) => {
      const fileExtension = extensionFromFilename(curr);
      const isAllowed = ALLOWED_STEP_EXTENSIONS.some(
        (allowedExtension) =>
          allowedExtension.toLowerCase() === fileExtension.toLowerCase()
      );
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
        : !isAllowed
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

const getRelativePathComponents = (path: string) =>
  path.replace(/^\//, "").split("/");

export const getRelativePathTo = (filePath: string, targetFolder: string) => {
  const cleanFilePathComponents = getRelativePathComponents(filePath);
  const cleanTargetFolderComponents = getRelativePathComponents(targetFolder);

  const firstDiffIndex = findFirstDiffIndex(
    cleanFilePathComponents,
    cleanTargetFolderComponents
  );

  const remainingFilePathComponents = cleanFilePathComponents.slice(
    firstDiffIndex
  );

  const upLevels = cleanTargetFolderComponents.length - firstDiffIndex - 1;

  const leadingString = upLevels >= 0 ? "../".repeat(upLevels) : "";

  return `${leadingString}${remainingFilePathComponents.join("/")}`;
};

export const filePathFromHTMLElement = (element: HTMLElement) => {
  let dataPath = element.getAttribute("data-path");
  if (dataPath) {
    return dataPath;
  } else if (element.parentElement) {
    return filePathFromHTMLElement(element.parentElement);
  } else {
    return undefined;
  }
};

const dataFolderRegex = /^\/data\:?\//;

export const isWithinDataFolder = (filePath: string) =>
  dataFolderRegex.test(filePath);

const getFilePathInDataFolder = (dragFilePath: string) =>
  cleanFilePath(dragFilePath);

export const getFilePathForRelativeToProject = (
  absFilePath: string,
  pipelineCwd: string
) => {
  return isWithinDataFolder(absFilePath)
    ? getFilePathInDataFolder(absFilePath)
    : getRelativePathTo(cleanFilePath(absFilePath), pipelineCwd);
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

// ancesterPath has to be an folder because a file cannot be a parent
const isAncester = (ancesterPath: string, childPath: string) =>
  ancesterPath.endsWith("/") && childPath.startsWith(ancesterPath);

/**
 * This function removes the child path if its ancester path already appears in the list.
 * e.g. given selection ["/a/", "/a/b.py"], "/a/b.py" should be removed.
 * @param list {string[]}
 * @returns {string[]}
 */
export const filterRedundantChildPaths = (list: string[]) => {
  // ancestor will be processed first
  const sortedList = list.sort();

  const listSet = new Set<string>([]);

  for (let item of sortedList) {
    const filteredList = [...listSet];

    // If filteredItem is an ancestor of item
    const hasIncluded = filteredList.some((filteredItem) =>
      isAncester(filteredItem, item)
    );

    if (!hasIncluded) listSet.add(item);
  }

  return [...listSet];
};

export const getBaseNameFromPath = (combinedPath: string) => {
  let pathComponents = combinedPath.split("/");
  if (combinedPath.endsWith("/")) {
    pathComponents = pathComponents.slice(0, -1);
  }
  return pathComponents.slice(-1)[0];
};

export const findPipelineFilePathsWithinFolders = async (
  projectUuid: string,
  filePaths: UnpackedPath[]
): Promise<UnpackedPath[]> => {
  const files = await Promise.all(
    filePaths.map(({ root, path }) => {
      if (!path.endsWith("/"))
        return isFileByExtension(["orchest"], path) ? { root, path } : null;
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
    })
  );

  return (files.filter((value) => hasValue(value)) as UnpackedPath[]).flatMap(
    (value) => value
  );
};
