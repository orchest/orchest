import { FileMetadata, UnpackedMove } from "./file";
import {
  directoryLevel,
  dirname,
  isDirectory,
  join,
  parents,
  relative,
  segments,
} from "./path";

/** Maps a path to file metadata which is used to represent a set of files. */
export type FileMap = { [path: string]: FileMetadata };
export type FileMapEntry = readonly [string, FileMetadata];

export const fileMetadata = (
  path: string,
  fetchedAt?: number
): FileMetadata => ({
  isDirectory: isDirectory(path),
  fetchedAt: fetchedAt ?? Date.now(),
});

/**
 * Sorts the file map by path in ascending order with the directories first.
 */
export const sortFileMap = (fileMap: FileMap) => {
  const entries = Object.entries(fileMap).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const directories: FileMapEntry[] = [];
  const files: FileMapEntry[] = [];

  for (const entry of entries) {
    if (isDirectory(entry[0])) directories.push(entry);
    else files.push(entry);
  }

  return Object.fromEntries([...directories, ...files]);
};

export const addToFileMap = (fileMap: FileMap, ...paths: string[]): FileMap => {
  // Always include all parents to prevent orphans:
  const withParents = paths.flatMap((path) => [path, ...parents(path)]);
  const addedAt = Date.now();

  return sortFileMap({
    ...fileMap,
    ...Object.fromEntries(
      withParents.map((path) => [
        path,
        fileMap[path] ?? fileMetadata(path, addedAt),
      ])
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
export const moveBetween = <R extends string = string>(
  roots: Partial<Record<R, FileMap>>,
  move: UnpackedMove
): Partial<Record<R, FileMap>> => {
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
    directoryContents(fileMap, directory)
  ).filter((path) => !contents.includes(path));
  // Add the directory using `addToFileMap` to avoid orphaned paths.
  const newMap = addToFileMap(
    removeFromFileMap(fileMap, ...removed),
    directory
  );

  for (const entry of contents) {
    newMap[entry] = fileMetadata(entry, replacedAt);
  }

  return sortFileMap(newMap);
};

export const isChildOf = (path: string, directory: string): boolean =>
  path.startsWith(directory) && path !== directory;

/** Given a file map, Returns the children (including grandchildren) of a directory. */
export const children = (fileMap: FileMap, directory: string): FileMap =>
  Object.fromEntries(
    Object.entries(fileMap).filter(([path]) => isChildOf(path, directory))
  );

export const isDirectChildOf = (path: string, directory: string): boolean =>
  isChildOf(path, directory) &&
  segments(path.substring(directory.length)).length === 1;

/**
 * Given a file map, returns the paths which are direct children of a directory.
 * The returned paths are all absolute.
 */
export const directoryContents = (
  fileMap: FileMap,
  directory: string
): FileMap =>
  Object.fromEntries(
    Object.entries(fileMap).filter(([path]) => isDirectChildOf(path, directory))
  );

export const fileMapDepth = (fileMap: FileMap) =>
  Object.keys(fileMap).reduce(
    (depth, path) => Math.max(depth, directoryLevel(path)),
    0
  ) + 1;
