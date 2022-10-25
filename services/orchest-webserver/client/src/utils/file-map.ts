import { UnpackedMove } from "@/pipeline-view/file-manager/common";
import {
  dirname,
  isDirectory,
  join,
  parents,
  relative,
  segments,
} from "./path";

export type FileMetadata = { isDirectory: boolean; fetchedAt: number };
/** Maps a path to file metadata which is used to represent a set of files. */
export type FileMap = { [path: string]: FileMetadata };

const fileMetadata = (path: string, fetchedAt?: number): FileMetadata => ({
  isDirectory: isDirectory(path),
  fetchedAt: fetchedAt ?? Date.now(),
});

export const sortFileMap = (fileMap: FileMap) =>
  Object.fromEntries(
    Object.entries(fileMap).sort(([a], [b]) => a.localeCompare(b))
  );

export const addToFileMap = (fileMap: FileMap, path: string): FileMap => {
  // Always include all parents to prevent orphans:
  const paths = [...parents(path), path];
  const addedAt = Date.now();

  return sortFileMap({
    ...fileMap,
    ...Object.fromEntries(
      paths.map((path) => [path, fileMap[path] ?? fileMetadata(path, addedAt)])
    ),
  });
};

/**
 * Removes paths from the file map.
 * If a directory is removed, all its children are removed as well.
 */
export const removeFromFileMap = (
  fileMap: FileMap,
  ...paths: string[]
): FileMap => {
  const newMap = { ...fileMap };

  for (const path of paths) {
    if (isDirectory(path)) {
      for (const child of Object.keys(children(newMap, path))) {
        delete newMap[child];
      }
    }

    delete newMap[path];
  }

  return newMap;
};

/** Moves the path within its own root or to a different one. */
export const movePath = (
  roots: Record<string, FileMap>,
  move: UnpackedMove
): Record<string, FileMap> => {
  const oldRoot = { ...roots[move.oldRoot] };
  const newRoot =
    move.oldRoot === move.newRoot ? oldRoot : { ...roots[move.newRoot] };
  const oldMetadata = oldRoot[move.oldPath];

  delete oldRoot[move.oldPath];
  newRoot[move.newPath] = oldMetadata ?? fileMetadata(move.newPath);

  if (isDirectory(move.oldPath)) {
    for (const oldChild of Object.keys(children(oldRoot, move.oldPath))) {
      const childMetadata = oldRoot[oldChild] ?? {};
      delete oldRoot[oldChild];

      const newChild = join(move.newPath, relative(move.oldPath, oldChild));
      newRoot[newChild] = childMetadata ?? fileMetadata(newChild);
    }
  }

  return {
    ...roots,
    [move.oldRoot]: oldRoot,
    [move.newRoot]: sortFileMap(newRoot),
  };
};

/**
 * Replaces the contents of a directory,
 * ensuring that the children of deleted sub-directories are also removed.
 * @param fileMap The file map to operate on
 * @param contents The direct children of the directory to replace.
 */
export const replaceDirectoryContents = (
  fileMap: FileMap,
  contents: string[]
): FileMap => {
  const directory = dirname(contents[0]);
  const replacedAt = Date.now();
  const removed: string[] = Object.keys(
    directChildren(fileMap, directory)
  ).filter((path) => !contents.includes(path));

  return sortFileMap(
    Object.fromEntries(
      Object.entries(removeFromFileMap(fileMap, ...removed)).concat(
        contents.map((path) => [path, fileMetadata(path, replacedAt)])
      )
    )
  );
};

export const isChildOf = (path: string, directory: string): boolean =>
  path.startsWith(directory) && path !== directory;

/** Returns the children (including grandchildren) of the directory within the file map. */
export const children = (fileMap: FileMap, directory: string): FileMap =>
  Object.fromEntries(
    Object.entries(fileMap).filter(([path]) => isChildOf(path, directory))
  );

export const isDirectChildOf = (path: string, directory: string): boolean =>
  isChildOf(path, directory) &&
  segments(path.substring(directory.length)).length === 1;

/**
 * Given a file map, returns the paths which are direct children of the directory within the file map.
 * The returned path are all absolute.
 */
export const directChildren = (fileMap: FileMap, directory: string): FileMap =>
  Object.fromEntries(
    Object.entries(fileMap).filter(([path]) => isDirectChildOf(path, directory))
  );
