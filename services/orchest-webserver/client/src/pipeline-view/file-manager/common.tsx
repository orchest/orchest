import { Step } from "@/types";

export const FILE_MANAGER_ENDPOINT = "/async/file-manager";
export const FILE_MANAGER_ROOT_CLASS = "file-manager-root";
export const PROJECT_DIR_PATH = "/project-dir";
export const ROOT_SEPARATOR = ":";

export type TreeNode = {
  children: TreeNode[];
  path: string;
  type: "directory" | "file";
  name: string;
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

export const unpackCombinedPath = (combinedPath: string) => {
  // combinedPath includes the root
  // e.g. /project-dir:/abc/def
  // Note, the root can't contain the special character ':'
  let root = combinedPath.split(ROOT_SEPARATOR)[0];
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
  let targetDescription = `'${baseNameFromPath(parentPath)}'`;
  if (targetDescription === "''") {
    targetDescription = "the root";
  }
  return targetDescription;
};

export const deduceRenameFromDragOperation = (
  sourcePath: string,
  targetPath: string
) => {
  if (sourcePath === targetPath) {
    return [sourcePath, targetPath];
  }
  const sep = "/";
  let isSourceDir = sourcePath.endsWith(sep);
  let isTargetDir = targetPath.endsWith(sep);

  let newPath: string;

  let sourceBasename = baseNameFromPath(sourcePath);

  // Check if target is child of sourceDir
  if (targetPath.startsWith(sourcePath)) {
    // Break out with no-op. Illegal move
    return [sourcePath, sourcePath];
  }

  if (isTargetDir) {
    newPath = targetPath + sourceBasename;
  } else {
    let targetParentDirPath =
      targetPath.split(sep).slice(0, -1).join(sep) + sep;
    newPath = targetParentDirPath + sourceBasename;
  }

  if (isSourceDir) {
    newPath += sep;
  }

  return [sourcePath, newPath];
};

/**
 * File API functions
 */

function isDirectoryEntry(
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

async function traverseDirectory(
  entry: FileSystemEntry,
  onEncounter: (entry: FileSystemFileEntry) => void
) {
  // return entry if entry is file
  if (!isDirectoryEntry(entry)) return entry;

  const reader = entry.createReader();
  // Resolved when the entire directory is traversed
  return new Promise((resolve, reject) => {
    const iterationResults = [];
    function readEntries() {
      // According to the FileSystem API spec, readEntries() must be called until
      // it calls the callback with an empty array. Seriously?
      reader.readEntries(
        (entries) => {
          if (!entries.length) {
            // Done iterating this particular directory
            resolve(Promise.all(iterationResults));
          } else {
            // Add a list of promises for each directory entry.  If the entry is itself
            // a directory, then that promise won't resolve until it is fully traversed.
            iterationResults.push(
              Promise.all(
                entries.map((entry) => {
                  return traverseDirectory(entry, onEncounter);
                })
              )
            );
            // Try calling readEntries() again for the same dir, according to spec
            readEntries();
          }
        },
        (error) => reject(error)
      );
    }
    readEntries();
  });
}

async function processFileEntry(entry: FileSystemFileEntry) {
  let file = await new Promise((resolve) => {
    entry.file((file) => {
      Object.defineProperty(file, "webkitRelativePath", {
        value: entry.fullPath.slice(1),
      });
      resolve(file);
    });
  });

  return file;
}

export const mergeTrees = (subTree, tree) => {
  // Modifies tree
  // subTree root path
  let { parent } = searchTree(subTree.path, tree);
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

export const getActiveRoot = (selected: string[], treeRoots: string[]) => {
  if (selected.length === 0) {
    return treeRoots[0];
  } else {
    const { root } = unpackCombinedPath(selected[0]);
    return root;
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
export const isCombinedPathChildLess = (combinedPath, fileTrees) => {
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

export const cleanFilePath = (filePath: string) =>
  filePath.replace(/^\/project-dir\:\//, "");

/**
 * remove leading "./" of a file path
 * @param filePath string
 * @returns string
 */
export const removeLeadingSymbols = (filePath: string) =>
  filePath.replace(/^\.\//, "");

// user might enter "./foo.ipynb", but it's equivalent to "foo.ipynb".
// this function cleans up the leading "./"
export const getStepFilePath = (step: Step) =>
  removeLeadingSymbols(step.file_path);

export const isNotebookFile = (filePath: string) => /\.ipynb$/.test(filePath);
